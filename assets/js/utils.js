function formatarNumero(n) {
  return n < 10 ? '0' + n : '' + n;
}

function minutosParaHM(minutos) {
  const sinal = minutos < 0 ? '-' : '', m = Math.abs(minutos);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return sinal + h + 'h' + formatarNumero(mm);
}

function hmParaMinutos(hm) {
  if (!hm) return null;

  let partes;
  if (hm.includes('h')) {
    partes = hm.split('h');
  } else if (hm.includes(':')) {
    partes = hm.split(':');
  } else {
    return null;
  }

  if (partes.length < 2) return null;
  const hh = parseInt(partes[0], 10);
  const mm = parseInt(partes[1], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function chaveMes(data) {
  return data.getFullYear() + '-' + formatarNumero(data.getMonth() + 1);
}

function diasNoMes(mes) {
  return new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
}
