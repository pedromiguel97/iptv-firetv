# TV Aberta para Fire TV

Player de canais gratuitos do mundo inteiro (lista do projeto iptv-org), mesmo app da versão Samsung, empacotado como APK Android.

## Link de download (para o app Downloader)

Acesse o downloader, pelo FireTV e cole o link abaixo:

```
https://github.com/pedromiguel97/tvaberta-firetv/releases/latest/download/TVAberta.apk
```

## Estrutura

- `app/src/main/assets/www/`: o app web (HTML, CSS, JS, fonte e hls.js);
- `app/src/main/java/br/tvaberta/MainActivity.java`: abre o app num WebView em tela cheia e repassa o controle;
- `.github/workflows/build.yml`: compila o APK e publica uma release a cada push na `main`.
