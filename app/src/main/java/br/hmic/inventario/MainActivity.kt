package br.hmic.inventario

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.text.InputType
import android.util.Base64
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File

/**
 * App "Inventário CC - HMIC"
 * Abre o Web App do Google Apps Script em tela cheia e salva os PDFs no celular.
 * O endereço do Web App é informado no primeiro uso e pode ser trocado depois
 * (botão Voltar na tela inicial → "Alterar endereço").
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var progresso: ProgressBar
    private lateinit var telaErro: LinearLayout
    private val prefs by lazy { getSharedPreferences("config", Context.MODE_PRIVATE) }

    private val corPrincipal = Color.parseColor("#0F4C5C")

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = corPrincipal

        val raiz = FrameLayout(this)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mediaPlaybackRequiresUserGesture = true
            addJavascriptInterface(Ponte(), "AndroidApp")
            webViewClient = Cliente()
            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView?, p: Int) {
                    progresso.progress = p
                    progresso.visibility = if (p < 100) View.VISIBLE else View.GONE
                }
            }
            setDownloadListener { url, _, _, _, _ ->
                if (url.startsWith("http")) abrirExterno(url)
            }
        }

        progresso = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#2E7D32"))
        }

        telaErro = montarTelaErro()

        raiz.addView(web, FrameLayout.LayoutParams(-1, -1))
        raiz.addView(progresso, FrameLayout.LayoutParams(-1, 10, Gravity.TOP))
        raiz.addView(telaErro, FrameLayout.LayoutParams(-1, -1))
        setContentView(raiz)

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState)
        } else {
            val url = prefs.getString("url", "") ?: ""
            if (url.isBlank()) pedirEndereco(primeiraVez = true) else carregar(url)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    /* ---------------- navegação ---------------- */

    private fun carregar(url: String) {
        telaErro.visibility = View.GONE
        web.visibility = View.VISIBLE
        web.loadUrl(url)
    }

    private inner class Cliente : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
            val host = req.url.host ?: return false
            val interno = host == "script.google.com" || host.endsWith("googleusercontent.com") ||
                host == "accounts.google.com" || host == "docs.google.com"
            if (interno) return false
            abrirExterno(req.url.toString())
            return true
        }

        override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
            if (req.isForMainFrame) {
                web.visibility = View.GONE
                telaErro.visibility = View.VISIBLE
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) { web.goBack(); return }
        AlertDialog.Builder(this)
            .setTitle("Inventário CC - HMIC")
            .setItems(arrayOf("Recarregar página", "Alterar endereço do sistema", "Sair do app")) { _, i ->
                when (i) {
                    0 -> carregar(prefs.getString("url", "") ?: "")
                    1 -> pedirEndereco(primeiraVez = false)
                    2 -> finish()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun pedirEndereco(primeiraVez: Boolean) {
        val campo = EditText(this).apply {
            hint = "https://script.google.com/macros/s/.../exec"
            inputType = InputType.TYPE_TEXT_VARIATION_URI
            setText(prefs.getString("url", ""))
        }
        val caixa = FrameLayout(this).apply {
            setPadding(48, 16, 48, 0)
            addView(campo)
        }
        val dlg = AlertDialog.Builder(this)
            .setTitle("Endereço do sistema")
            .setMessage("Cole o link do App da Web (Apps Script → Implantar → Gerenciar implantações).")
            .setView(caixa)
            .setCancelable(!primeiraVez)
            .setPositiveButton("Salvar", null)
            .apply { if (!primeiraVez) setNegativeButton("Cancelar", null) }
            .create()
        dlg.setOnShowListener {
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val url = campo.text.toString().trim()
                if (!url.startsWith("https://script.google.com/")) {
                    campo.error = "O link deve começar com https://script.google.com/"
                } else {
                    prefs.edit().putString("url", url).apply()
                    dlg.dismiss()
                    web.clearHistory()
                    carregar(url)
                }
            }
        }
        dlg.show()
    }

    private fun montarTelaErro(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(60, 60, 60, 60)
        setBackgroundColor(Color.parseColor("#F2F5F7"))
        visibility = View.GONE
        addView(TextView(context).apply {
            text = "Sem conexão com o sistema"
            textSize = 20f
            setTextColor(corPrincipal)
            gravity = Gravity.CENTER
        })
        addView(TextView(context).apply {
            text = "Verifique a internet do celular e tente de novo."
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(0, 20, 0, 40)
        })
        addView(Button(context).apply {
            text = "Tentar novamente"
            setOnClickListener { carregar(prefs.getString("url", "") ?: "") }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        addView(Button(context).apply {
            text = "Alterar endereço"
            setOnClickListener { pedirEndereco(primeiraVez = false) }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    private fun abrirExterno(url: String) {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        catch (e: ActivityNotFoundException) { toast("Nenhum app para abrir o link.") }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    /* ---------------- PDF ---------------- */

    /** Chamado pela página (Index.html) quando o app está rodando. */
    private inner class Ponte {
        @JavascriptInterface
        fun ehApp(): Boolean = true

        @JavascriptInterface
        fun salvarPdf(base64: String, nome: String) {
            runOnUiThread {
                try {
                    val bytes = Base64.decode(base64, Base64.DEFAULT)
                    val nomeSeguro = nome.replace(Regex("[\\\\/:*?\"<>|]"), "_")
                    val uri = gravar(bytes, nomeSeguro)
                    perguntarAcao(uri, nomeSeguro)
                } catch (e: Exception) {
                    toast("Erro ao salvar o PDF: ${e.message}")
                }
            }
        }
    }

    private fun gravar(bytes: ByteArray, nome: String): Uri {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val valores = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, nome)
                put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Inventario HMIC")
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores)
                ?: throw IllegalStateException("não foi possível criar o arquivo")
            contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
            uri
        } else {
            val pasta = File(getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), "Inventario HMIC").apply { mkdirs() }
            val arq = File(pasta, nome)
            arq.writeBytes(bytes)
            FileProvider.getUriForFile(this, "$packageName.arquivos", arq)
        }
    }

    private fun perguntarAcao(uri: Uri, nome: String) {
        val onde = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) "Downloads/Inventario HMIC" else "pasta do app"
        AlertDialog.Builder(this)
            .setTitle("PDF salvo")
            .setMessage("$nome\n\nSalvo em: $onde")
            .setPositiveButton("Abrir") { _, _ ->
                val i = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                try { startActivity(i) } catch (e: ActivityNotFoundException) { toast("Instale um leitor de PDF para abrir.") }
            }
            .setNeutralButton("Compartilhar") { _, _ ->
                val i = Intent(Intent.ACTION_SEND).setType("application/pdf")
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .putExtra(Intent.EXTRA_SUBJECT, nome)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                startActivity(Intent.createChooser(i, "Enviar PDF"))
            }
            .setNegativeButton("Fechar", null)
            .show()
    }
}
