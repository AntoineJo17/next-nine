#!/usr/bin/env python3
"""Serveur statique pour les mesures : comme `python3 -m http.server`, mais avec une file d'attente
TCP large. Le serveur standard (backlog 5) refuse des connexions quand plusieurs pages chargent leurs
modules en meme temps (net::ERR_SOCKET_NOT_CONNECTED), ce qui laisse une page bloquee sur
"Preparation du terrain..." : un artefact du banc de mesure, pas du jeu.

  python3 scripts/perf/serve.py [port=8773] [dossier=dist]
"""
import functools, http.server, sys

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8773
root = sys.argv[2] if len(sys.argv) > 2 else "dist"


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    daemon_threads = True


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


Server(("127.0.0.1", port), functools.partial(Quiet, directory=root)).serve_forever()
