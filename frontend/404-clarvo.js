(function () {
  var DESTINO = 'https://clarvo.mx';
  var segundos = 6;
  var texto = document.getElementById('texto-redirigiendo');
  var temporizador = window.setInterval(function () {
    segundos -= 1;
    if (segundos <= 0) {
      window.clearInterval(temporizador);
      window.location.href = DESTINO;
      return;
    }
    texto.textContent = 'Redirigiendo en ' + segundos + ' segundos…';
  }, 1000);
})();
