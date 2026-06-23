import { spawn } from 'child_process';
import * as readline from 'readline';

function runServer() {
    console.log('Iniciando os servidores de desenvolvimento...');
    const command = 'ts-node-dev';
    const args = ['-r', 'tsconfig-paths/register', '--respawn', '--transpile-only', 'server.ts'];

    const serverProcess = spawn(command, args, { stdio: 'inherit', shell: true });

    serverProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`O servidor de desenvolvimento foi encerrado inesperadamente com o código ${code}.`);
        }
    });
}

function buildAndRun() {
    console.log('Iniciando o build dos recursos...');
    const buildProcess = spawn('npm', ['run', 'build:gen'], { stdio: 'inherit', shell: true });

    buildProcess.on('close', (code) => {
        if (code === 0) {
            console.log('Build de recursos concluído com sucesso.');
            runServer();
        } else {
            console.error(`O build de recursos falhou com o código ${code}. O servidor não será iniciado.`);
            process.exit(code ?? 1);
        }
    });

    buildProcess.on('error', (err) => {
        console.error(`Falha ao executar o build de recursos: ${err.message}`);
        process.exit(1);
    });
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('Como você gostaria de iniciar o ambiente de desenvolvimento?');
console.log('1 - Executar servidores (padrão)');
console.log('2 - Buildar recursos e executar servidores');
console.log('');

rl.question('Escolha uma opção (pressione Enter para a padrão): ', (answer) => {
    rl.close();
    const choice = answer.trim();

    if (choice === '2') {
        buildAndRun();
    } else {
        runServer();
    }
});