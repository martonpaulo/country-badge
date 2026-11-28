"""Serve a folder over HTTP for the browser suite: `serve.py PORT DIRECTORY`.

`python3 -m http.server` keeps the default listen backlog of 5. The page loads about fifteen
ES modules at once, and the suite runs several browsers against one server, so a burst of
connections overflowed the backlog and the kernel reset some of them (`ERR_CONNECTION_RESET`
on a module), which left the page with its search disabled. A larger backlog takes the burst.
"""
import functools
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Server(ThreadingHTTPServer):
    request_queue_size = 256


def main(port: int, directory: str) -> None:
    handler = functools.partial(SimpleHTTPRequestHandler, directory=directory)
    with Server(("127.0.0.1", port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main(int(sys.argv[1]), sys.argv[2])
