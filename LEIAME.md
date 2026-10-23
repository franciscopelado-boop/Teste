# App Android — Inventário CC HMIC

App que abre o sistema de inventário (Google Apps Script) em tela cheia e salva os PDFs
direto no celular (pasta **Downloads/Inventario HMIC**), com opção de abrir ou compartilhar (WhatsApp, e-mail...).

## 1. Antes: ajustar a implantação do Apps Script

O Google não permite login de conta Google dentro de apps desse tipo. Por isso a implantação precisa ser:

- **Executar como:** Eu
- **Quem pode acessar:** Qualquer pessoa

Atualize também o `Index.html` no Apps Script com a versão nova (ela salva o PDF pelo app)
e faça **Implantar → Gerenciar implantações → Editar → Nova versão**.

## 2. Gerar o APK pelo GitHub (sem instalar nada no PC)

1. Crie uma conta em github.com (grátis) e um repositório novo (pode ser privado).
2. Clique em **uploading an existing file** e envie **todo o conteúdo desta pasta**
   (inclusive a pasta `.github`). Clique em **Commit changes**.
3. Abra a aba **Actions**. O processo "Gerar APK" roda sozinho (uns 4–6 minutos).
4. Quando ficar verde, clique nele e baixe **Inventario-CC-HMIC-apk** em *Artifacts*.
   Dentro do .zip está o `Inventario-CC-HMIC.apk`.

> Dica: a pasta `.github` às vezes fica oculta no Windows. Se o upload não levar ela,
> crie no GitHub o arquivo `.github/workflows/gerar-apk.yml` (Add file → Create new file)
> e cole o conteúdo do arquivo de mesmo nome.

## 2b. Ou pelo Android Studio

Abra esta pasta no Android Studio → **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

## 3. Instalar no celular

1. Envie o APK para o celular (WhatsApp, Drive, cabo).
2. Toque no arquivo e permita **instalar apps de fontes desconhecidas** quando o Android pedir.
3. Ao abrir pela primeira vez, cole o link do App da Web
   (`https://script.google.com/macros/s/.../exec`).

## Uso

- **Voltar** na tela inicial abre o menu: Recarregar, Alterar endereço, Sair.
- **Salvar em PDF** grava o arquivo e pergunta se quer abrir ou compartilhar.
- **Imprimir** no app gera o PDF; a impressão é feita pelo leitor de PDF.
- Requer Android 8.0 ou superior e internet.
