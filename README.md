# Affix

Affix e um rastreador de progresso curricular para o Bacharelado em Sistemas de Informacao da UFRPE, campus Recife, matriz presencial SIN02.

## Comandos

```bash
npm install
npm run dev
npm run build
python tools/fetch_ufrpe_curriculum.py
```

## Estrutura

- `src/main.ts`: aplicacao TypeScript no navegador.
- `src/style.css`: tema visual neutro e responsivo.
- `src/data/curriculum.json`: dados da matriz SIN02 usados pela interface.
- `tools/fetch_ufrpe_curriculum.py`: coleta a estrutura curricular publica no SIGAA da UFRPE.

O progresso do aluno fica salvo no `localStorage` do navegador.
