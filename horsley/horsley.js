    async sell() {
        this.howManyCoinsWasBouthLastTime = 0;
        const howMuchShouldSell = await this.howMuchCoins('sell');
        this.action = this.actionStatuses[2];
        // Binance request for sell
        if (!this.demo) {
            let sell = this.binance.marketSell(this.currencyPair, howMuchShouldSell);
            sell.then((result) => {
                this.profit = this.getProfit(howMuchShouldSell);
                // Fill the sellPrice field from the Binance response
                if (Array.isArray(result.fills) && result.length) {
                    this.sellPrice = result.fills[0].price;
                } else {
                    this.sellPrice = this.currentContitionals.price;
                }
                let haveSell = result.executedQty ? result.executedQty : howMuchShouldSell;
                this.buyTaker = 0;
                this.safetyLine = this.getSafetyLine(true);
                // Write into Firebase
                this.createOrder('sell', this.sellPrice, haveSell).then(()=>{
                        this.sendCommissionFromWallet(this.profit, this.demo)
                    }
                ).catch();
                // push the last operation data into the socket channel
                this.sendDataToFirebase(this.actionStatuses[2], haveSell);
                this.binance.balance((error, balances) => {
                    if ( error ) return console.error(error);
                    rtdb.ref('binanceWallets/' + this.userId).set(balances)
                });
            })
                .catch(e => console.log(e));
        } else {
            this.sellPrice = this.currentContitionals.price;
            this.buyTaker = 0;
            this.safetyLine = this.getSafetyLine(true);
            this.profit = this.getProfit(1);
            this.demoWalletAmount = this.demoWalletAmount + this.profit;
            await rtdb.ref('demoBalance/' + this.userId).set({walletVolume:this.demoWalletAmount});
            // Write into Firebase
            console.log('sell using demo')
            this.createOrder('sell', this.sellPrice, 1).then(()=>{
                    this.sendCommissionFromWallet(this.profit, this.demo)
                }
            ).catch();
            // push the last operation data into the socket channel
            this.sendDataToFirebase(this.actionStatuses[2]);
        }

    }

    /**
     * Method for getting current balance
     */
    getBalanceOfWallet(first, second) {
        return new Promise(async (resolve, reject) => {
            let data = {};
            await this.binance.balance((error, balances) => {
                if (error) reject(error);
                if (balances[first]) {
                    data.first = balances[first].available;
                }
                if (balances[second]) {
                    data.second = balances[second].available;
                }
                this.totalWalletForSession = balances.USDT?.available;
                if (!this.totalWalletForSession || this.totalWalletForSession === 0) {
                    this.totalWalletForSession = balances.USDT?.available;
                }
                resolve(data);
            });
        });
    }

    getProfit(manual = false) {
        if (manual) {
            return ((this.currentContitionals.price - this.getTakerCommission(this.currentContitionals.price, this.taker)) - (this.buyPrice + this.buyTaker)) * manual;
        }
        return ((this.currentContitionals.price - this.getTakerCommission(this.currentContitionals.price, this.taker)) - (this.buyPrice + this.buyTaker)) * this.howManyCoinsWasBouthLastTime;
    }

    /**
     * Extra Sell function for "Sell now and off" button
     */
    async extraSell(price, taker, currencyPair) {
        taker = this.taker;
        if (this.currentPrice) {
            console.log('Need to specify extraPrice attribute in extraSell message');
            createError(this.userId, {"errMsg":"Need to specify extraPrice attribute in extraSell message as params"})
            this.extraStopTool();
            
        }
        var lastOrder;
        await rtdb.ref('actions/' + this.userId).orderByKey().limitToLast(1).once('value', snapshot => {
            lastOrder = Object.values(snapshot.val())[0]
        });
        if (lastOrder) {
            let totalOfWallet = this.totalWalletForSession;
            this.howManyCoinsWasBouthLastTime = await this.howMuchCoins('sell');
            this.action = this.actionStatuses[2];
            // Binance request for sell
            if (!this.demo) {
                let extraSell = this.binance.marketSell(this.currencyPair, this.howManyCoinsWasBouthLastTime);
                extraSell.then((result) => {
                    this.profit = (result.cummulativeQuoteQty - result.fills[0].commission) - ((lastOrder.price * lastOrder.amount) - this.getTakerCommission(lastOrder.price, taker));
                    this.sellPrice = result.fills[0].price;
                    this.buyTaker = 0;
                    this.currencyPair = currencyPair;
                    this.createOrder('sell', this.currentPrice).then(()=>{
                            this.sendCommissionFromWallet(this.profit, this.demo)
                        }
                    ).catch();
                    this.sendDataToFirebase(this.actionStatuses[2], false, totalOfWallet);
                    console.log("EXTRA SELL NOT IN DEMO")
                });
            } else {
                console.log('demo sell work')
                this.howManyCoinsWasBouthLastTime = 1;
                this.profit = ((this.currentPrice - this.getTakerCommission(this.currentPrice, taker)) - (lastOrder.price + this.getTakerCommission(lastOrder.price, taker)));
                this.sellPrice = this.currentPrice;
                this.demoWalletAmount = this.demoWalletAmount + this.profit;
                await rtdb.ref('demoBalance/' + this.userId).set({walletVolume:this.demoWalletAmount});
                this.buyTaker = 0;
                this.currencyPair = currencyPair;
                this.createOrder('sell', this.currentPrice, 1).then(()=>{
                    this.sendCommissionFromWallet(this.profit, this.demo)
                    }
                ).catch();
                this.sendDataToFirebase(false, false, false, this.profit);
                console.log("EXTRA SELL IN DEMO MODE")
            }
        }
    }

    async howMuchCoins(operationType) {
        const firstCurrency = this.currencyPairNotSplitted.split("/")[0];
        const secondCurrency = this.currencyPairNotSplitted.split("/")[1];
        let countFirstCurrency = 0;
        let countSecondCurrency = 0;
        let sliceVar = 2;
        const wallet = await this.getBalanceOfWallet(firstCurrency, secondCurrency);
        if (wallet.first && wallet.second) {
            countFirstCurrency = parseFloat(wallet.first);
            countSecondCurrency = ((wallet.second / 100) * this.walletVolume);
        }
        if (firstCurrency === 'BNB') {
            sliceVar = 4;
        }
        switch (operationType) {
            case 'buy':{
                let countedCoins = (countSecondCurrency / this.currentPrice).toFixed(9).slice(0, -sliceVar)
                return countedCoins;
            }
            case 'sell':{
                return countFirstCurrency.toFixed(7).slice(0, -sliceVar);
            }
        }
    }

    getTakerCommission(price, taker) {
        return ((this.howManyCoinsWasBouthLastTime / 100) * taker) * price;
    }
