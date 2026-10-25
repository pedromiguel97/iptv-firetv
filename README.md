# TV Aberta para Fire TV

Player de canais gratuitos do mundo inteiro (lista do projeto iptv-org), mesmo app da versão Samsung, empacotado como APK Android.

## Link de download (para o app Downloader)

Depois que o GitHub Actions terminar, o APK mais recente fica sempre em:

```
https://github.com/SEU_USUARIO/tvaberta-firetv/releases/latest/download/TVAberta.apk
```

Troque `SEU_USUARIO` pelo seu usuário do GitHub. O repositório precisa ser **público**.

## Estrutura

- `app/src/main/assets/www/`: o app web (HTML, CSS, JS, fonte e hls.js). O mesmo código roda na Samsung.
- `app/src/main/java/br/tvaberta/MainActivity.java`: abre o app num WebView em tela cheia e repassa o controle.
- `.github/workflows/build.yml`: compila o APK e publica uma release a cada push na `main`.

## Atualizar o app

Edite os arquivos, faça commit e push. O Actions gera uma versão nova, e é só baixar de novo pelo mesmo link no Downloader e instalar por cima.

A chave de assinatura (`app/tvaberta.keystore`) fica no repositório para permitir instalar por cima. Ela serve só para este app pessoal: não use para nada publicado em loja.
