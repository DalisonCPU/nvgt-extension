const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const filePath = path.join(context.extensionPath, 'data', 'nvgt_functions.json');
  const rawData = fs.readFileSync(filePath);
  const functions = JSON.parse(rawData);

  // Completion Provider: sugere todas as funções do JSON
  const completions = vscode.languages.registerCompletionItemProvider(
    'nvgt',
    {
      provideCompletionItems() {
        const items = functions.map(func => {
          const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
          item.insertText = func.name + '(';
          item.detail = `${func.name}(${func.params.join(', ')})`;
          item.documentation = new vscode.MarkdownString(func.description);
          return item;
        });
        return items;
      }
    },
    ...functions.map(f => f.name[0]) // dispara no primeiro caractere de cada função
  );

  // Signature Help Provider: mostra parâmetros e ignora vírgulas dentro de strings
  const signatures = vscode.languages.registerSignatureHelpProvider(
    'nvgt',
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {vscode.CancellationToken} token
       * @param {vscode.SignatureHelpContext} context
       */
      provideSignatureHelp(document, position, token, context) {
        const sigs = functions.map(func => {
          const sig = new vscode.SignatureInformation(
            `${func.name}(${func.params.join(', ')})`,
            func.description
          );
          sig.parameters = func.params.map(param => new vscode.ParameterInformation(param));
          return sig;
        });

        const help = new vscode.SignatureHelp();
        help.signatures = sigs;
        help.activeSignature = 0; // será corrigido dinamicamente

        // pega o texto da linha até o cursor
        const lineText = document.lineAt(position.line).text;
        const textUpToCursor = lineText.substring(0, position.character);
        const openPar = textUpToCursor.lastIndexOf('(');
        const argsText = openPar >= 0 ? textUpToCursor.slice(openPar + 1) : '';

        // NOVO: detecta o nome da função antes do parêntese
        let functionName = '';
        if (openPar > 0) {
          const beforeOpenPar = textUpToCursor.substring(0, openPar).trim();
          const match = beforeOpenPar.match(/([a-zA-Z0-9_]+)$/);
          if (match) {
            functionName = match[1];
          }
        }

        // define a assinatura ativa correta
        const activeSigIndex = functions.findIndex(func => func.name === functionName);
        if (activeSigIndex >= 0) {
          help.activeSignature = activeSigIndex;
        } else {
          // Se não encontrou a função, cancela o SignatureHelp
          return null;
        }
        
        // conta vírgulas fora de strings
        let inString = false;
        let commaCount = 0;
        for (const ch of argsText) {
          if (ch === '"' || ch === "'") {
            inString = !inString;
          } else if (ch === ',' && !inString) {
            commaCount++;
          }
        }

        help.activeParameter = commaCount;
        return help;
      }
    },
    '(', ',' // dispara em "(" e ","
  );

  context.subscriptions.push(completions, signatures);
}

function deactivate() {}

module.exports = { activate, deactivate };
