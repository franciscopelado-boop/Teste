# 🛒 Minhas Compras

App web (PWA) para registrar compras do mercado e acompanhar se os preços subiram ou baixaram de um mês para o outro.

## Funcionalidades

- **Adicionar itens** com nome, quantidade e preço unitário — o total vai sendo somado na hora.
- **Código de barras**: escaneie com a câmera do celular (botão 📷), digite, ou use um leitor USB/Bluetooth. Produtos já cadastrados têm o nome preenchido automaticamente.
- **Comparação de preços**: ao digitar o preço, o app mostra o último preço pago em meses anteriores e se **subiu ▲** (vermelho) ou **baixou ▼** (verde), com a porcentagem.
- **Finalizar compra**: mostra o total com **data, dia da semana e hora**, quantos itens subiram/baixaram e o total do mês comparado ao mês anterior.
- **Histórico** agrupado por mês, com o total de cada mês e a variação em relação ao mês anterior. Toque numa compra para ver os detalhes.
- **Produtos**: histórico de preço de cada produto mês a mês.
- **Backup**: exportar/importar os dados em JSON.
- Funciona offline depois da primeira abertura e pode ser instalado na tela inicial do celular.

Os produtos são identificados pelo código de barras; sem código, pelo nome (ignorando maiúsculas e acentos).

## Como usar

Os dados ficam salvos no navegador do próprio aparelho (`localStorage`).

A câmera só funciona em **HTTPS** (ou `localhost`). A forma mais simples é publicar com o **GitHub Pages**:

1. No repositório, vá em *Settings → Pages*.
2. Em *Source*, escolha a branch e a pasta `/ (root)` e salve.
3. Abra o link gerado no celular e use *"Adicionar à tela inicial"*.

Para testar no computador:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```
