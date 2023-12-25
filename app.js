var ccxt = require('ccxt')
const TELE = require('node-telegram-bot-api');
const http = require('http');
const fs = require('fs');
const POS = require('./class.js');
require('./configs.js');


//-- vars
var __orders = [];
var ex;

//-- telegram
const bot = new TELE(TELEGRAM_TOKEN, { polling: true });
let m = bot.sendMessage(TELEGRAM_ID, 'heyyy', {parse_mode: 'HTML'})
//.then(call => { call.message_id });



//-- listener
const listener = http.createServer(async (req, res) =>
{
    res.writeHead(200, {'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'});
    let path = req.url.split('/');

    if(req.url === "/")
    {
        fs.readFile('./controller.html', 'utf-8', (err, data) =>
        {
            if (!err)
                res.end(data.replace('[SERVER_IP]', SERVER_IP).replace('[PORT]', PORT));
        });
    }
    else if (req.url === '/CONTROLLER')
    {
        let resp = "OPENS";
        console.log(__orders);
        __orders.forEach((o) =>
            {
                let proff = o.enter2 == 0 ? "?" : (!o.profit.toString().includes('-') ? "+" + o.profit: o.profit) + "%";
                resp += "/" + o.symbol + ":" + o.LS + ":" + (o.enter2==0?o.enter:o.enter2) + ":" + o.target + ":" + o.stop + ":" + o.itsTest.toString() + ":" + proff
            });
        res.write(Buffer.from(resp, 'utf-8'));
        res.end();
    }
    else if (path[1] && path[1].includes(':'))
    {
        res.write(Buffer.from('<HTML><BODY>OK_ORDER_TAKED</BODY></HTML>', 'utf-8'));
        res.end();
        console.log(">> new request: " + req.url);

        let cmds = path[1].split(':');

         if (cmds[0] === 'DEBUG')
        {
            bot.sendMessage(_tele_id, cmds[1], {parse_mode: 'HTML'});
            console.log('[DEBUG]: ' + cmds[1] + ' !!\n');
        }
        else if (cmds[0] === 'TIMEOUT' && cmds[1] === 'TIMEOUT')
        {
            __orders.forEach((o) => (o.itsON = false));
            bot.sendMessage(_tele_id, '<u>REPORT:</u> TIMEOUT called, ALL of positions CLOSED.', {parse_mode: 'HTML'});
            console.log('[COMMAND]: ' + 'TIMEOUT Command, ALL of positions CLOSED !!!\n');
        }
        else if (cmds[1] === 'TIMEOUT')
        {
            __orders.forEach((o) =>
            {
                if (o.symbol === cmds[0])
                    o.itsON = false;
            });
            bot.sendMessage(_tele_id, '<u>REPORT:</u> TIMEOUT called, Just ' + cmds[0] + ' CLOSED.', {parse_mode: 'HTML'});
            console.log('[COMMAND]: ' + 'TIMEOUT Command, Its ' + cmds[0] + ' !!\n');
        }
        else if (__orders.length < MAX_POSITION)
        {
            let notThere = true;
            __orders.forEach((o) =>
            {
                if (o.symbol === cmds[0] && o.LS === cmds[2])
                    notThere = false;
            });

            if (notThere)
            {
                // NAME:FUTURE:LS:PRICE:ZARIB:TARGET:STOP:POWER:MARKET:NOLOSS:TRAIL:TEST:CANCEL
                const me = new POS();
                me.text = path[1];
                me.symbol = cmds[0];
                me.itsFuture = cmds[1].toLowerCase() === "true";
                me.LS = cmds[2];
                me.enter = parseFloat(cmds[3]);
                me.zarib = parseFloat(cmds[4]);
                me.target = parseFloat(cmds[5]);
                me.stop = parseFloat(cmds[6]);
                me.power = parseFloat(cmds[7]);
                me.market = cmds[8].toLowerCase() === "true";
                me.noLoss = parseFloat(cmds[9]);
                me.trail = parseFloat(cmds[10]);
                me.itsTest = cmds[11].toLowerCase() === "true";
                me.cancel = parseFloat(cmds[12]);
                await setupOrder(me);
            }
            console.log('[COMMAND]: ' + 'OH, ORDER ' + cmds[2] + ', Its ' + cmds[0] + ' On ' + cmds[3] + ' ... ^^\n');
        }
    }
});

listener.listen(PORT, async () =>
{
    console.log(`>> running at http://localhost:${PORT}/`);
    
    if(BROKER == "COINEX")
    {
        ex = new ccxt.coinex
        ({
            'apiKey': API_KEY,
            'secret': API_SEC,
            'options': {
                'defaultType': 'swap',
                'defaultMarginMode': 'isolated',
            },
        });
    }
    else if(BROKER == "MEXC")
    {
        ex = new ccxt.mexc
        ({
            'apiKey': API_KEY,
            'secret': API_SEC,
            'options': {
                'defaultType': 'swap',
                'defaultMarginMode': 'isolated',
            },
        });
    }
    else if(BROKER == "BINGX")
    {
        ex = new ccxt.bingx({
            'apiKey': API_KEY,
            'secret': API_SEC,
            'options': {
                'defaultType': 'margin',
                'defaultMarginMode': 'isolated',
            },
        })
    }

    
    const balance = await ex.fetchBalance()
    console.log(balance);
});

async function setupOrder(me)
{
    return new Promise(async (resolve) =>
    {
        __orders.push(me);

        if (me.zarib > MAX_LEVERAGE)
            me.zarib = MAX_LEVERAGE;

        let wasOpen = false;
        __orders.forEach((o) =>
        {
            if (o != me && o.symbol == me.symbol)
            {
                o.itsON = false;
                wasOpen = true;
            }
        });
        if (wasOpen)
            await sleep(5000);

        if (!me.itsON)
        {
            console.log("[COMMAND]: " + "Oops, Pos Removed before PLACE, Its " + me.symbol + " ... :||\n");
            removeOrder(me);
            return;
        }

        if (TEST_MODE)
            me.itsTest = true;

        me.size = SIZE * me.power * me.zarib / me.enter;

        let roundCount = 0;
        if (me.size < 0.0001)
            roundCount = 5;
        else if (me.size < 0.001)
            roundCount = 4;
        else if (me.size < 0.01)
            roundCount = 3;
        else if (me.size < 0.1)
            roundCount = 2;
        else if (me.size < 1)
            roundCount = 1;
        me.QuDecimal = roundCount;

        if (me.LS == "L")
        {
            me.side1 = "buy";
            me.side2 = "sell";
            me.emojiLS = "🐮";
        }
        else
        {
            me.side1 = "sell";
            me.side2 = "buy";
            me.emojiLS = "🐻";
        }


        await handleOrder(me);

        let pR = 6 - me.enter.toString().Split('.')[0].length;
        let txt = "<b>[LS]</b> #" + me.symbol + ", on <b>" + roundNumber(me.enter, pR) + "</b> ..." + me.emojiLS + "\n• TP " + roundNumber(me.target, pR) + ", SL " + roundNumber(me.stop, pR) + ", Lev x" + me.zarib;
        txt = me.LS == "L" ? txt.replace("[LS]", "Buy") : txt.replace("[LS]", "Sell");
        
        console.log("[ORDER]: " + "OPEN, Its " + me.symbol + " ... :))\n");
        bot.sendMessage(TELEGRAM_ID, txt, {parse_mode: 'HTML'})
        .then(call => { me.messageId = call.message_id });
        

        //resolve('THE END');
    });
}

async function handleOrder(me)
{
    while(true)
    {
        const tickers = await ex.fetchTickers ();
        let now = tickers[me.symbol + '/USDT:USDT'].last;
        console.log(now);

        if (me.enter2 == 0)
        {
            let cancel = Math.abs((now - me.cancel) / now * 100);
            if(cancel <= 0.1)
            {
                console.log("[ORDER]: " + "Sorry, Cancel on Open POS, Its " + me.symbol + " ... :((");
                bot.sendMessage(TELEGRAM_ID, "Cancel Opening #" + me.symbol, {parse_mode: 'HTML', reply_to_message_id: me.messageId});

                //clearInterval(timer);
                removeOrder(me);
                break;
            }

            let ekhtelaf = Math.abs((now - me.enter) / now * 100);
            if (!me.market || ekhtelaf <= 0.1)
            {
                let order_success = false;
                let order_error = "";
                let trys = 0;
                if (!me.itsTest)
                {
                    while (!order_success && trys < 5)
                    {
                        if (me.itsFuture)
                        {
                            //const leverage = await ex.setLeverage(me.zarib, me.symbol + '/USDT:USDT', {side: (me.side1=="buy"?"LONG":"SHORT")});
                            //console.log(leverage);
                            const leverage1 = await ex.setLeverage(me.zarib, me.symbol + '/USDT:USDT', {side: "LONG"});
                            console.log(leverage1);
                            const leverage2 = await ex.setLeverage(me.zarib, me.symbol + '/USDT:USDT', {side: "SHORT"});
                            console.log(leverage2);
                            const order = await ex.createOrder(me.symbol + '/USDT:USDT', 'market', me.side1, roundNumber(me.size, me.QuDecimal))
                            console.log(order);

                            order_success = true;
                        }
                        else
                        {
                        
                        }

                        trys++;
                    }
                }
                else
                    order_success = true;


                if (order_success)
                {
                    let msg = "[ORDER]: " + "POSITION, Its " + me.symbol + " ... :))\n";
                    console.log(msg);
                    bot.sendMessage(TELEGRAM_ID, msg, {parse_mode: 'HTML', reply_to_message_id: me.messageId});
                    me.enter2 = now;
                    me.bigest = me.enter2;
                }
                else
                {
                    console.log("[ORDER]: " + "Sorry, Error on Open POS, Its " + me.symbol + " ... :((\nDetails: " + order_error + "\n");
                    bot.sendMessage(TELEGRAM_ID, "Error Opening #" + me.symbol + "\nError Details: " + order_error + " " + roundNumber(me.size, me.QuDecimal).toString(), {parse_mode: 'HTML', reply_to_message_id: me.messageId});

                    //clearInterval(timer);
                    removeOrder(me);
                    break;
                }

            }
        }
        else
        {
            if (me.LS == "L")
            {
                if (now >= me.target)
                    me.itsON = false;

                if (RISK_FREE && me.noLoss != 0 && now >= me.noLoss)
                    me.stop = me.enter2;

                if (TRAILING && me.trail != 0 && now > me.bigest)
                {
                    me.bigest = now;
                    me.stop = now - (now * me.trail / 100);
                }

                if (now <= me.stop)
                    me.itsON = false;
            }
            else
            {
                if (now <= me.target)
                    me.itsON = false;

                if (RISK_FREE && me.noLoss != 0 && now <= me.noLoss)
                    me.stop = me.enter2;

                if (TRAILING && me.trail != 0 && now < me.bigest)
                {
                    me.bigest = now;
                    me.stop = now + (now * me.trail / 100);
                }

                if (now >= me.stop)
                    me.itsON = false;
            }

            let profit = (me.LS == "L") ? (now - me.enter2) / me.enter2 * 100 : (me.enter2 - now) / me.enter2 * 100;
            me.profit = roundNumber(profit * me.zarib * me.power, 2);
        }

        if (me.itsON == false && me.itsOnCloseProcess == false)
        {
            me.itsOnCloseProcess = true;
            //clearInterval(timer);

            if (!me.itsFuture)
                me.size = me.size - (me.size * 0.001);

            let ItsCloosed = true;
            let err_count = 0;
            while (ItsCloosed)
            {

                let close_success = false;
                let close_error = "";
                if (!me.itsTest)
                {
                    try
                    {
                        if (me.itsFuture)
                        {
                            const order = await ex.createOrder(me.symbol + '/USDT:USDT', 'market', me.side2, roundNumber(me.size, me.QuDecimal), 0, {'reduce_only':true})
                            console.log(order);

                            close_success = true;
                        }
                        else
                        {
                            
                        }
                    }
                    catch (e)
                    {
                        close_error = e.message;
                    }
                }
                else
                    close_success = true;

                let profitString = (me.profit >= 0) ? "+" + me.profit.toString() + "% 🟢" : me.profit.toString() + "% 🔴";
                let txt = "<b>Close</b> #" + me.symbol + ", " + me.emojiLS + " <b>" + profitString + "</b>";

                if (!close_success)
                {
                    err_count++;
                    if (err_count > 3)
                    {
                        bot.sendMessage(TELEGRAM_ID, txt + "<br>Close Error: " + close_error + "\n❌ its Emergency, Bot Cant Close Position, Close it FAST.", {parse_mode: 'HTML', reply_to_message_id: me.messageId});

                        console.log("[ORDER]: " + "Sorry, Error on Close POS, Its " + me.symbol + " ... :((\nDetails: " + close_error + "\n");
                        close_success = true;
                    }
                }

                if (close_success)
                {
                    ItsCloosed = false;
                    removeOrder(me);

                    let pathSave = "DBOX/PROFIT/";
                    if (me.itsTest)
                        pathSave = "DBOX/TESTNET/";
                    fs.writeFileSync(pathSave + new Date().getTime().toString(), me.text + ":" + me.profit.toString(), 'utf-8');
                    //UpdateReport();

                    if (err_count <= 3)
                    {
                        bot.sendMessage(TELEGRAM_ID, txt, {parse_mode: 'HTML', reply_to_message_id: me.messageId});
                        console.log("[ORDER]: " + "CLOSE, Its " + me.symbol + " with " + profitString + " ... :))\n");
                    }
                }
            }
            
            break;
        }

        //await sleep(1000);
    }
}

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
        //const order = await ex.createOrder('DOGE/USDT:USDT', 'market', 'sell', 100, 0)
        console.log(order)
    } catch (e) {
        console.log(e.constructor.name, e.message)
    }
}

//main()


function removeOrder(o)
{
    var indx = __orders.indexOf(o);
    if (indx !== -1) {
        __orders.splice(indx, 1);
    } 
}

function roundNumber(number, decimalPlaces) {
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.round(number * multiplier) / multiplier;
}