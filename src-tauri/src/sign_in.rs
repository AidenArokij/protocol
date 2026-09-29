//! Signing in with Discord happens in the player's own browser; it comes back to this one-off listener
//! on 127.0.0.1 with a code (or an error) in the query string, which goes to the overlay to finish the
//! sign-in. The code is worthless without the secret the overlay keeps (PKCE).

use serde_json::json;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Where the browser comes back to: must match the redirect URLs allowed in the Supabase project.
const ADDRESS: &str = "127.0.0.1:47321";
/// Told to the overlay: `{ generation, query }`, the query null when given up or timed out.
const SIGN_IN_EVENT: &str = "sign-in-back";
/// A sign-in nobody finishes in this long is given up.
const TIMEOUT: Duration = Duration::from_secs(600);

/// Which sign-in is under way: a new one, or a cancel, moves it on and the older listener stops.
static GENERATION: AtomicU64 = AtomicU64::new(0);

const PAGE_DONE: &str = "Вход выполнен. Вкладку можно закрыть и вернуться в игру.";
const PAGE_FAILED: &str = "Войти не получилось. Вернитесь в хелпер и попробуйте ещё раз.";

/// Starts listening for the browser; returns this sign-in's number, which comes back with the answer.
#[tauri::command]
pub fn sign_in_listen(app: AppHandle) -> Result<u64, String> {
  let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
  // An older listener lets the port go within a moment of being moved on.
  let started = Instant::now();
  let listener = loop {
    match TcpListener::bind(ADDRESS) {
      Ok(listener) => break listener,
      Err(_) if started.elapsed() < Duration::from_secs(2) => std::thread::sleep(Duration::from_millis(100)),
      Err(e) => return Err(format!("Порт {ADDRESS} занят: {e}")),
    }
  };
  listener.set_nonblocking(true).map_err(|e| e.to_string())?;

  std::thread::spawn(move || {
    let query = wait(&listener, generation);
    drop(listener);
    let _ = app.emit_to("main", SIGN_IN_EVENT, json!({ "generation": generation, "query": query }));
  });
  Ok(generation)
}

/// Gives up the sign-in under way.
#[tauri::command]
pub fn sign_in_cancel() {
  GENERATION.fetch_add(1, Ordering::SeqCst);
}

fn wait(listener: &TcpListener, generation: u64) -> Option<String> {
  let deadline = Instant::now() + TIMEOUT;
  while GENERATION.load(Ordering::SeqCst) == generation && Instant::now() < deadline {
    match listener.accept() {
      Ok((stream, _)) => {
        if let Some(query) = answer(stream) {
          return Some(query);
        }
      }
      // Nobody yet (WouldBlock), or a connection that broke off: look again in a moment.
      Err(_) => std::thread::sleep(Duration::from_millis(150)),
    }
  }
  None
}

/// Answers one request: the browser's return, with a page saying how it went, or anything else (the
/// favicon) with nothing. Returns the query string of a return.
fn answer(mut stream: TcpStream) -> Option<String> {
  stream.set_nonblocking(false).ok()?;
  stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
  let mut request = Vec::new();
  let mut buffer = [0u8; 2048];
  while !request.windows(4).any(|w| w == b"\r\n\r\n") && request.len() < 16 * 1024 {
    let read = stream.read(&mut buffer).ok()?;
    if read == 0 {
      break;
    }
    request.extend_from_slice(&buffer[..read]);
  }
  let request = String::from_utf8_lossy(&request);
  let Some(query) = returned_query(&request) else {
    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    return None;
  };
  let text = if has_key(query, "code") { PAGE_DONE } else { PAGE_FAILED };
  let page = format!(
    "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><title>РО Хелпер</title></head>\
     <body style=\"margin:0;height:100vh;display:grid;place-items:center;background:#12151c;color:#e8ebf2;\
     font:600 20px system-ui,sans-serif\"><p>{text}</p></body></html>"
  );
  let _ = stream.write_all(
    format!(
      "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{page}",
      page.len()
    )
    .as_bytes(),
  );
  Some(query.to_string())
}

/// The query string of the browser coming back from a sign-in — one with a code or an error, on whatever
/// path (Supabase falls back to the site's root when the redirect is not allowed) — or nothing.
fn returned_query(request: &str) -> Option<&str> {
  let target = request.lines().next()?.split(' ').nth(1)?;
  let query = target.split_once('?')?.1;
  (has_key(query, "code") || has_key(query, "error")).then_some(query)
}

fn has_key(query: &str, key: &str) -> bool {
  query.split('&').any(|pair| pair.split('=').next() == Some(key))
}

#[cfg(test)]
mod tests {
  use super::returned_query;

  #[test]
  fn takes_the_code_or_the_error_the_browser_comes_back_with() {
    let back = "GET /auth/callback?code=abc-123 HTTP/1.1\r\nHost: 127.0.0.1:47321\r\n\r\n";
    assert_eq!(returned_query(back), Some("code=abc-123"));
    let refused = "GET /auth/callback?error=access_denied&error_description=The+user+denied HTTP/1.1\r\n\r\n";
    assert_eq!(returned_query(refused), Some("error=access_denied&error_description=The+user+denied"));
    assert_eq!(returned_query("GET /?code=xyz HTTP/1.1\r\n\r\n"), Some("code=xyz"));
  }

  #[test]
  fn leaves_anything_else_alone() {
    assert_eq!(returned_query("GET /favicon.ico HTTP/1.1\r\n\r\n"), None);
    assert_eq!(returned_query("GET /auth/callback?codex=1 HTTP/1.1\r\n\r\n"), None);
    assert_eq!(returned_query(""), None);
  }
}
