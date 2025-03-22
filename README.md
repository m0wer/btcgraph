# BTCgraph

Web UI for network graph analysis of Bitcoin transactions.

## Development

The files need to be served by a web server. The easiest way to do this is to
use a Python or Node web server.

```bash
cs src
python -m http.server
```

or with Node.js:

```bash
cs src
npx http-server
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Used libraries

* https://github.com/graphology/graphology
* https://github.com/jacomyal/sigma.js
