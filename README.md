# Affix · BSI UFRPE

Acompanhamento acadêmico do Bacharelado em Sistemas de Informação da UFRPE, inspirado no [yggdrasil2](https://github.com/akaFTS/yggdrasil2).

O site é estático: HTML, CSS e JavaScript, compatível com GitHub Pages. Disciplinas, projetos, optativas e horas complementares são calculados no navegador. O progresso é importado e exportado em JSON e também fica salvo localmente no navegador. Não há cadastro, backup remoto, chave de acesso ou banco de dados na aplicação.

## Executar localmente

Com Python instalado, execute na raiz do projeto:

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory frontend
```

Abra **http://127.0.0.1:8000**. Esse comando apenas serve os arquivos estáticos; não é necessário instalar dependências Python para visualizar o site. `npm run dev` executa o mesmo comando.

## Progresso e arquivos JSON

1. Em **Meus dados e backup → Importar JSON**, selecione um arquivo de progresso. O conteúdo é validado, e a substituição dos dados locais pede confirmação.
2. Marque as disciplinas como Não iniciada, Planejada, Cursando ou Concluída. Apenas Concluída soma horas. É possível começar do zero sem importar um arquivo.
3. No 7º período, escolha Projeto para Sociedade I ou Projeto de Soluções Complexas I. No 8º, escolha Projeto para Sociedade II ou Projeto de Soluções Complexas II. Ao selecionar uma opção, a alternativa do mesmo período volta para Não iniciada. Cada período soma no máximo 60h de projeto.
4. Registre as optativas e as atividades complementares. O cálculo aplica os limites e as pontuações da tabela fornecida.
5. Use **Exportar progresso** para baixar um novo JSON com as alterações. O arquivo importado não é modificado automaticamente. Para continuar em outro navegador ou dispositivo, importe a cópia exportada mais recente.
6. **Zerar progresso** remove situações de disciplinas, escolhas de projetos e atividades deste navegador, após confirmação. O nome e os arquivos já exportados são preservados.

As seções ficam em uma única página, com filtros independentes e categorias recolhidas por padrão. O menu leva a cada seção sem trocar de tela.

Os arquivos importados são lidos no navegador e não são enviados ao GitHub ou a outro servidor. O salvamento local vale para aquele navegador e endereço do site; limpar os dados do navegador remove essa cópia. Guarde o JSON exportado para recuperar o progresso. Os comprovantes originais das atividades devem ser guardados separadamente.

## Desenvolvimento e validação offline

Python 3.12 ou superior e Node 22 para os testes JavaScript:

```powershell
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements-dev.txt
./.venv/Scripts/python -m pytest -q
node --test tests/progress.test.js
python scripts/build_static.py
```

Para validar e calcular um arquivo de progresso com Python, sem servidor:

```powershell
./.venv/Scripts/python -m backend.progress CAMINHO/DO/PROGRESSO.json
```

A ferramenta valida o JSON e imprime o resumo no terminal. Não altera o arquivo nem transmite seus dados. A suíte compara os cálculos Python e JavaScript, incluindo projetos exclusivos por período, migração de backups antigos, limites de atividades, importação e zeramento.

## Fontes e regras de integralização

Os documentos originais ficam em [source](./source/). O catálogo gerado está em [catalog.json](./frontend/data/catalog.json). Nomes, cores e equivalências das obrigatórias foram transcritos visualmente da matriz rasterizada; seus IDs são internos. Os códigos das 77 optativas vêm do PDF fornecido.

| Exigência | Horas |
| --- | ---: |
| Obrigatórias e projetos, incluindo Educação Física A | 1.950 |
| TCC | 420 |
| Optativas | 480 |
| Atividades complementares | 240 |
| **Total** | **3.090** |

- Cada par de projetos do 7º e do 8º período representa um componente de 60h. O total e a quantidade de componentes não contam as alternativas duas vezes.
- Educação Física A aparece com 30h na figura e fecha o total de 1.950h obrigatórias antes do TCC.
- Tópicos Especiais e Prática Integrada compartilham o teto de 45h da célula mesclada B5:B6 da planilha.
- Publicação Qualis A recebe 120h brutas, mas o teto de publicação é 90h.
- Horas excedentes de optativas ou atividades não substituem obrigatórias.
- Os códigos repetidos e sobrepostos da aba `componentes` não são usados como identificadores de atividades.
- As setas transcritas da matriz servem para orientação; as fontes não apresentam regras completas de matrícula nem os pré-requisitos das optativas. Aproveitamento e integralização dependem da homologação da universidade.

O formato atual de progresso é `schema_version: 2`. Arquivos da versão 1 são aceitos e adaptados para escolhas por período. Se um arquivo antigo tem ambas as alternativas selecionadas no mesmo período, a opção da antiga trilha é mantida. Uma escolha única é preservada mesmo se pertencer à outra trilha. Na migração automática do navegador, o JSON original é guardado em `affix-legacy-progress-backup-v1` antes de salvar o formato novo.

Para regenerar o catálogo após revisar as fontes:

```powershell
./.venv/Scripts/python scripts/build_catalog.py
```

## Estrutura

- [frontend](./frontend/): arquivos estáticos, temas e cálculo no navegador.
- [backend](./backend/): validação e cálculo offline em Python; não é publicado nem utilizado pela interface.
- [scripts](./scripts/): extração das fontes, geração do catálogo e build estático.
- [tests](./tests/): regras de negócio, arquivos JSON e equivalência entre Python e JavaScript.
- [source](./source/): documentos originais, exclusivos do desenvolvimento.

A referência yggdrasil2 foi usada como inspiração funcional. A implementação e a interface foram criadas para este projeto, sem copiar seus ícones ou código.
