var ccxt = require('ccxt')
const TELE = require('node-telegram-bot-api');

const token = '1346254020:AAEJDY_K3DJRwcZLhSAzEjwWbl6aW7QRwn8';
const bot = new TELE(token, { polling: true });
bot.sendMessage(235276411, 'heyyy');

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    //bot.sendMessage(chatId, 'Hello World');
});

async function main() {

    /*const ex = new ccxt.bingx({
        'apiKey': '6pvRnMpur1naM79HeLZBmA2PzDkiABgNkw0e97w34yNc0EkTWhvcZbgKho248pavE46pasIadSB0U7eWkE8Cw',
        'secret': 'Oxf8P4m8KBnYoTcyW4SQobOectRnEQc6n8nKHYjx6TI3F4Uabhm04nQXIlxwZfuZxFHzSUjOobu7Si2fA',
        'options': {
            'defaultType': 'margin',
        },
    })*/
    const ex = new ccxt.coinex({
        'apiKey': 'DAC1880A049C43319FAC6FA6534F8DDD',
        'secret': '3E872D25DC7D7FD9C0A5A6CB70CD880845ABB72B5C73D518',
        'options': {
            'defaultType': 'swap',
            'defaultMarginMode': 'isolated',
        },
    })
    /*const ex = new ccxt.mexc({
        'apiKey': 'mx0vglYEjGRfxlnApf',
        'secret': 'dd174d525bb94850abb60b7c0ebbcd90',
        'options': {
            'defaultType': 'swap',
        },
    })*/

    const balance = await ex.fetchBalance()
    console.log(balance);

    //const markets = await ex.loadMarkets()
    //ex.verbose = true // uncomment for debugging purposes if necessary

    const leverage = await ex.setLeverage(10, 'DOGE/USDT:USDT')
    console.log(leverage);

    const params = {
        //'stopPrice': YOUR_STOP_PRICE_HERE,
        'timeInForce': 'GTC',
    }

    try {
        const order = await ex.createOrder('DOGE/USDT:USDT', 'market', 'sell', 100, 0)
        console.log(order)
    } catch (e) {
        console.log(e.constructor.name, e.message)
    }
}

main()