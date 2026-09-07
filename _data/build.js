// Her build'de değişen sürüm damgası: tarayıcıların eski CSS/JS'i önbellekten
// sunmasını engeller.
module.exports = () => ({ v: Date.now().toString(36) });
