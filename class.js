class POS
{
    constructor()
    {
        this.itsON = true;
        this.itsOnCloseProcess = false;
        this.itsFuture = false;
        this.itsTest = false;
        this.market = true;
        this.symbol = "";
        this.LS = "";
        this.enter = 0;
        this.enter2 = 0;
        this.zarib = 0;
        this.target = 0;
        this.stop = 0;
        this.profit = 0;
        this.power = 0;
        this.noLoss = 0;
        this.trail = 0;
        this.cancel = 0;
        this.QuDecimal = 0;
        this.bigest = 0;
        this.size = 0;
        this.side1 = 0;
        this.side2 = 0;
        this.emojiLS = "";
        this.messageId = 0
        this.text = ""
    }
}

module.exports = POS;