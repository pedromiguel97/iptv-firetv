package br.tvaberta;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Abre o TV Aberta (HTML/CSS/JS em assets/www) num WebView em tela cheia.
 * O controle do Fire TV é capturado aqui e repassado ao JavaScript,
 * usando os mesmos códigos de tecla da versão Samsung.
 */
public class MainActivity extends Activity {

    private WebView web;

    // Códigos que o main.js entende (os mesmos do controle Samsung)
    private static final int JS_ESQ = 37, JS_CIMA = 38, JS_DIR = 39, JS_BAIXO = 40;
    private static final int JS_OK = 13, JS_VOLTAR = 10009;
    private static final int JS_CH_MAIS = 427, JS_CH_MENOS = 428;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0e1630"));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // localStorage (último canal etc.)
        s.setMediaPlaybackRequiresUserGesture(false);    // vídeo começa sozinho
        s.setUseWideViewPort(true);                      // respeita width=1920 do HTML...
        s.setLoadWithOverviewMode(true);                 // ...e encaixa na tela
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);     // baixar lista e streams de outros sites
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Ponte(), "Android");

        setContentView(web);
        telaCheia();
        web.loadUrl("file:///android_asset/www/index.html");
        web.requestFocus();
    }

    /** Funções que o JavaScript pode chamar (window.Android.*) */
    private class Ponte {
        @JavascriptInterface
        public void sair() {
            runOnUiThread(MainActivity.this::finish);
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int js = traduzir(e.getKeyCode());
        if (js == 0) return super.dispatchKeyEvent(e);   // volume, Home etc. ficam com o sistema
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            web.evaluateJavascript("window.tvTecla && window.tvTecla(" + js + ")", null);
        }
        return true;
    }

    private int traduzir(int codigo) {
        switch (codigo) {
            case KeyEvent.KEYCODE_DPAD_LEFT: return JS_ESQ;
            case KeyEvent.KEYCODE_DPAD_UP: return JS_CIMA;
            case KeyEvent.KEYCODE_DPAD_RIGHT: return JS_DIR;
            case KeyEvent.KEYCODE_DPAD_DOWN: return JS_BAIXO;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return JS_OK;
            case KeyEvent.KEYCODE_BACK: return JS_VOLTAR;
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_PAGE_UP:
            case KeyEvent.KEYCODE_MEDIA_NEXT: return JS_CH_MAIS;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
            case KeyEvent.KEYCODE_PAGE_DOWN:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: return JS_CH_MENOS;
            default:
                // números (controles e teclados que têm)
                if (codigo >= KeyEvent.KEYCODE_0 && codigo <= KeyEvent.KEYCODE_9) {
                    return 48 + (codigo - KeyEvent.KEYCODE_0);
                }
                if (codigo >= KeyEvent.KEYCODE_NUMPAD_0 && codigo <= KeyEvent.KEYCODE_NUMPAD_9) {
                    return 48 + (codigo - KeyEvent.KEYCODE_NUMPAD_0);
                }
                return 0;
        }
    }

    @SuppressWarnings("deprecation")
    private void telaCheia() {
        web.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean temFoco) {
        super.onWindowFocusChanged(temFoco);
        if (temFoco) telaCheia();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("var v=document.getElementById('video'); if(v) v.pause();", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
