// Retorna o número de dias úteis pagos (escala ou folga, nunca feriado) entre duas datas (inclusive)
function obterDiasUteisPassados(dataInicio, dataFim) {
  let dias = 0;
  let data = new Date(dataInicio);
  while (data <= dataFim) {
    const iso = data.toISOString().slice(0, 10);
    const chave = chaveMes(data);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
    const escalaTrabalho = estado.configuracoes.escalaTrabalho;
    const deveTrabalhar = deveSerDiaUtil(data, escalaTrabalho);
    const isFolga = registro.isHoliday || registro.isFolga;
    const isFeriado = registro.isDayOff || registro.isFeriado;
    if ((deveTrabalhar || isFolga) && !isFeriado) {
      dias++;
    }
    data.setDate(data.getDate() + 1);
  }
  return dias;
}
const estado = {
  deslocamentoMes: 0,
  dados: {},
  configuracoes: {
    horasContrato: '8h45',
    arredondamento: 'threshold10',
    escalaTrabalho: '5x2',
    diaInicioCiclo: 25,
    entradaPadrao: '08:00',
    saidaAlmocoPadrao: '12:00',
    voltaAlmocoPadrao: '13:00',
    saidaPadrao: '17:45'
  }
};

const CHAVE_ARMAZENAMENTO = 'calcHoras:v1';

function carregarArmazenamento() {
  const dados = localStorage.getItem(CHAVE_ARMAZENAMENTO);
  if (dados) try {
    const obj = JSON.parse(dados);
    estado.dados = obj.data || obj.dados || {};
    
    if (obj.settings) {
      const config = obj.settings;
      estado.configuracoes = {
        horasContrato: config.contractHours || config.horasContrato || '8h45',
        arredondamento: config.rounding || config.arredondamento || 'threshold10',
        escalaTrabalho: config.workSchedule || config.escalaTrabalho || '5x2',
        diaInicioCiclo: config.cycleStartDay || config.diaInicioCiclo || 25,
        entradaPadrao: config.standardEntry || config.entradaPadrao || '08:00',
        saidaAlmocoPadrao: config.standardLunchOut || config.saidaAlmocoPadrao || '12:00',
        voltaAlmocoPadrao: config.standardLunchIn || config.voltaAlmocoPadrao || '13:00',
        saidaPadrao: config.standardExit || config.saidaPadrao || '17:45'
      };
    }
  } catch (e) { }
}

function salvarArmazenamento() {
  localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify({ 
    dados: estado.dados, 
    configuracoes: estado.configuracoes 
  }));
}

const rotuloMes = document.getElementById('monthLabel');
const containerDias = document.getElementById('days');
const totalDiasUteisEl = document.getElementById('workDaysTotal');
const totalEsperadoEl = document.getElementById('expectedTotal');
const totalTrabalhadoEl = document.getElementById('workedTotal');
const saldoEl = document.getElementById('balance');
const necessarioDiarioEl = document.getElementById('dailyNeeded');

const modal = document.getElementById('modal');
const horarioEntrada = document.getElementById('inTime');
const horarioSaidaAlmoco = document.getElementById('outLunch');
const horarioVoltaAlmoco = document.getElementById('inLunch');
const horarioSaida = document.getElementById('outTime');
const observacao = document.getElementById('note');
const checkFolga = document.getElementById('isHoliday');
const checkFeriado = document.getElementById('isDayOff');
let chaveEdicaoAtual = null;
let isoEdicaoAtual = null;

function abrirModalPara(iso, objData, inativo) {
  isoEdicaoAtual = iso;
  chaveEdicaoAtual = chaveMes(objData);
  document.getElementById('modalTitle').textContent = 'Editar: ' + objData.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const registro = (estado.dados[chaveEdicaoAtual] || {})[iso] || {};
  horarioEntrada.value = registro.in || registro.entrada || '';
  horarioSaidaAlmoco.value = registro.outLunch || registro.saidaAlmoco || '';
  horarioVoltaAlmoco.value = registro.inLunch || registro.voltaAlmoco || '';
  horarioSaida.value = registro.out || registro.saida || '';
  observacao.value = registro.note || registro.observacao || '';
  checkFolga.checked = registro.isHoliday || registro.isFolga || false;
  checkFeriado.checked = registro.isDayOff || registro.isFeriado || false;

  const checkAtestado = document.getElementById('modalIsSickLeave');
  const inicioAtestado = document.getElementById('modalSickLeaveStart');
  const fimAtestado = document.getElementById('modalSickLeaveEnd');

  checkAtestado.checked = registro.isSickLeave || registro.isAtestado || false;
  inicioAtestado.value = registro.sickLeaveStart || registro.inicioAtestado || '';
  fimAtestado.value = registro.sickLeaveEnd || registro.fimAtestado || '';

  alternarCamposHorario();
  alternarCamposAtestado();

  modal.style.display = 'flex';
}

function alternarCamposHorario() {
  const container = document.querySelector('.time-fields-container');
  const eFolga = checkFolga.checked;
  const eFeriado = checkFeriado.checked;

  if (container) {
    container.style.display = (eFolga || eFeriado) ? 'none' : 'block';
  }
}

function alternarCamposAtestado() {
  const camposAtestado = document.getElementById('sick-leave-time');
  const checkAtestado = document.getElementById('modalIsSickLeave');
  const eAtestado = checkAtestado.checked;
  camposAtestado.style.display = eAtestado ? 'block' : 'none';
}

function calcularHorasContrato() {
  const entrada = hmParaMinutos(estado.configuracoes.entradaPadrao);
  const saidaAlmoco = hmParaMinutos(estado.configuracoes.saidaAlmocoPadrao);
  const voltaAlmoco = hmParaMinutos(estado.configuracoes.voltaAlmocoPadrao);
  const saida = hmParaMinutos(estado.configuracoes.saidaPadrao);

  if (entrada !== null && saida !== null) {
    let totalMinutos = saida - entrada;

    if (saidaAlmoco !== null && voltaAlmoco !== null && voltaAlmoco > saidaAlmoco) {
      const intervaloAlmoco = voltaAlmoco - saidaAlmoco;
      totalMinutos -= intervaloAlmoco;
    }

    const horasCalculadas = minutosParaHM(totalMinutos);
    estado.configuracoes.horasContrato = horasCalculadas;
    document.getElementById('calculatedHours').textContent = horasCalculadas;
    console.log(`Horário padrão atualizado: ${estado.configuracoes.entradaPadrao}-${estado.configuracoes.saidaAlmocoPadrao} | ${estado.configuracoes.voltaAlmocoPadrao}-${estado.configuracoes.saidaPadrao} = ${horasCalculadas}`);

    return horasCalculadas;
  }

  return '8h45';
}

function calcularMinutosTrabalhados(registro, aplicarTolerancia = true) {
  if (registro.isHoliday || registro.isFolga || registro.isDayOff || registro.isFeriado) return 0;
  // Se houver atestado, descontar apenas o que exceder o intervalo do atestado
  let atestadoInicio = null, atestadoFim = null;
  if ((registro.isSickLeave || registro.isAtestado) && (registro.sickLeaveStart || registro.inicioAtestado) && (registro.sickLeaveEnd || registro.fimAtestado)) {
    atestadoInicio = hmParaMinutos(registro.sickLeaveStart || registro.inicioAtestado);
    atestadoFim = hmParaMinutos(registro.sickLeaveEnd || registro.fimAtestado);
  }

  let totalMinutosTrabalhados = 0;

  const entrada = hmParaMinutos(registro.in || registro.entrada);
  const saidaAlmoco = hmParaMinutos(registro.outLunch || registro.saidaAlmoco);
  const voltaAlmoco = hmParaMinutos(registro.inLunch || registro.voltaAlmoco);
  const saida = hmParaMinutos(registro.out || registro.saida);

  if (entrada !== null && saida !== null) {
    let trabalhoRegular = saida - entrada;
    if (voltaAlmoco !== null && saidaAlmoco !== null) {
      let inicioAlmoco = saidaAlmoco;
      let fimAlmoco = voltaAlmoco;
      let intervalo = fimAlmoco - inicioAlmoco;
      if (intervalo > 0) {
        // Se houver atestado, descontar apenas o tempo do almoço que NÃO está coberto pelo atestado
        if (atestadoInicio !== null && atestadoFim !== null && atestadoFim > atestadoInicio) {
          // Calcula sobreposição do atestado com o intervalo de almoço
          const sobreposicaoInicio = Math.max(inicioAlmoco, atestadoInicio);
          const sobreposicaoFim = Math.min(fimAlmoco, atestadoFim);
          let minutosSobrepostos = 0;
          if (sobreposicaoInicio < sobreposicaoFim) {
            minutosSobrepostos = sobreposicaoFim - sobreposicaoInicio;
          }
          intervalo = intervalo - minutosSobrepostos;
        }
        trabalhoRegular -= intervalo;
      }
    }
    console.log(`Trabalho: ${registro.in || registro.entrada || 'N/A'}-${registro.out || registro.saida || 'N/A'} = ${minutosParaHM(trabalhoRegular)} | Tolerância: ${estado.configuracoes.arredondamento}`);
    if (voltaAlmoco !== null && saidaAlmoco !== null) {
      console.log(`  Almoço: ${minutosParaHM(saidaAlmoco)}-${minutosParaHM(voltaAlmoco)} descontado`);
    }
    totalMinutosTrabalhados += trabalhoRegular;
  }

  // O cálculo de atestado foi removido daqui, pois não deve ser somado ao total trabalhado

  if (totalMinutosTrabalhados === 0 && entrada === null && saida === null && !registro.isSickLeave && !registro.isAtestado) {
    return null;
  }

  if (aplicarTolerancia && entrada !== null && saida !== null) {
    let trabalhoRegular = saida - entrada;
    if (voltaAlmoco !== null && saidaAlmoco !== null) {
      const intervalo = voltaAlmoco - saidaAlmoco;
      if (intervalo > 0) trabalhoRegular -= intervalo;
    }
    const ajustado = aplicarArredondamento(trabalhoRegular, registro);
    const ajuste = ajustado - trabalhoRegular;
    totalMinutosTrabalhados += ajuste;
    if (ajuste !== 0) {
      console.log(`  Tolerância aplicada: ${ajuste > 0 ? '+' : ''}${ajuste} min`);
    }
  }

  console.log(`RESULTADO: ${minutosParaHM(totalMinutosTrabalhados)} (${totalMinutosTrabalhados} min)`);

  return totalMinutosTrabalhados;
}

function obterInfoTolerancia(registro) {
  if (registro.isHoliday || registro.isFolga || registro.isDayOff || registro.isFeriado) return null;

  if ((registro.isSickLeave || registro.isAtestado) && (!registro.in && !registro.entrada || !registro.out && !registro.saida)) return null;

  const minutosBrutos = calcularMinutosTrabalhados(registro, false);
  const minutosAjustados = calcularMinutosTrabalhados(registro, true);

  if (minutosBrutos === null) return null;

  const minutosContrato = hmParaMinutos(estado.configuracoes.horasContrato) || 525;
  const diferenca = minutosBrutos - minutosContrato;
  const toleranciaAplicada = minutosBrutos !== minutosAjustados;

  return {
    bruto: minutosBrutos,
    ajustado: minutosAjustados,
    diferenca: diferenca,
    toleranciaAplicada: toleranciaAplicada
  };
}

function aplicarArredondamento(minutos, registro = null) {
  if (minutos === null) return null;
  const arred = estado.configuracoes.arredondamento;
  if (arred === 'none') return minutos;
  if (arred === 'nearest5') return Math.round(minutos / 5) * 5;
  if (arred === 'nearest10') return Math.round(minutos / 10) * 10;
  if (arred === 'nearest15') return Math.round(minutos / 15) * 15;
  if (arred === 'threshold10') {
    const minutosContratoDia = hmParaMinutos(estado.configuracoes.horasContrato) || 525;
    const diferenca = minutos - minutosContratoDia;

    if (Math.abs(diferenca) <= 10) {
      return minutosContratoDia;
    } else {
      return minutos;
    }
  }
  return minutos;
}

function obterDiasUteisMes(mesVisualizado, escalaTrabalho) {
  const ano = mesVisualizado.getFullYear();
  const mes = mesVisualizado.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  if (escalaTrabalho === 'custom') {
    let diasUteis = 0;
    const chave = chaveMes(mesVisualizado);
    const dadosMes = estado.dados[chave] || {};

    for (let d = 1; d <= diasNoMes; d++) {
      const iso = new Date(ano, mes, d).toISOString().slice(0, 10);
      const registro = dadosMes[iso] || {};
      if (!registro.isHoliday && !registro.isFolga) {
        diasUteis++;
      }
    }
    return diasUteis;
  }

  const [diasTrabalho, diasDescanso] = escalaTrabalho.split('x').map(Number);
  const diasCiclo = diasTrabalho + diasDescanso;

  let totalDiasUteis = 0;
  const chave = chaveMes(mesVisualizado);
  const dadosMes = estado.dados[chave] || {};

  for (let d = 1; d <= diasNoMes; d++) {
    const iso = new Date(ano, mes, d).toISOString().slice(0, 10);
    const registro = dadosMes[iso] || {};

    if (registro.isHoliday || registro.isFolga) {
      continue;
    }

    const diaAno = Math.floor((new Date(ano, mes, d) - new Date(ano, 0, 0)) / (24 * 60 * 60 * 1000));
    const posicaoCiclo = (diaAno - 1) % diasCiclo;

    if (posicaoCiclo < diasTrabalho) {
      totalDiasUteis++;
    }
  }

  return totalDiasUteis;
}

function recalcularTotais() {
  const { dataInicio, dataFim } = obterPeriodoCicloTrabalho();

  let soma = 0;
  let dataAtual = new Date(dataInicio);
    let diasTrabalhados = 0; // Total de dias trabalhados
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  // Definir diasUteisPassados corretamente aqui
    let diasUteisPassados = obterDiasUteisPassados(dataInicio, hoje); // Dias úteis passados

  const detalhesDiarios = [];
  let deficitTotal = 0;

  while (dataAtual <= dataFim && dataAtual <= hoje) {
    const iso = dataAtual.toISOString().slice(0, 10);
    const chave = chaveMes(dataAtual);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
    const escalaTrabalho = estado.configuracoes.escalaTrabalho;
    const deveTrabalhar = deveSerDiaUtil(dataAtual, escalaTrabalho);
    const isFolga = registro.isHoliday || registro.isFolga;
    const isFeriado = registro.isDayOff || registro.isFeriado;

    // Só conta se for dia útil pela escala OU folga (folga precisa ser paga), mas nunca feriado
    if ((deveTrabalhar || isFolga) && !isFeriado) {
      const mins = calcularMinutosTrabalhados(registro);
      const minutosContrato = hmParaMinutos(estado.configuracoes.horasContrato) || 525;
      const nomeDia = dataAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

      if (mins !== null) {
        soma += mins;
        diasTrabalhados++;

        const diferenca = mins - minutosContrato;
        if (diferenca < 0) {
          deficitTotal += Math.abs(diferenca);
          detalhesDiarios.push({
            data: iso,
            nomeDia: nomeDia,
            trabalhado: minutosParaHM(mins),
            esperado: minutosParaHM(minutosContrato),
            deficit: minutosParaHM(Math.abs(diferenca)),
            tipo: 'deficit'
          });
        } else if (diferenca > 0) {
          detalhesDiarios.push({
            data: iso,
            nomeDia: nomeDia,
            trabalhado: minutosParaHM(mins),
            esperado: minutosParaHM(minutosContrato),
            excedente: minutosParaHM(diferenca),
            tipo: 'excedente'
          });
        }
      } else {
        if (deveTrabalhar) {
          deficitTotal += minutosContrato;
          detalhesDiarios.push({
            data: iso,
            nomeDia: nomeDia,
            trabalhado: '0h00',
            esperado: minutosParaHM(minutosContrato),
            deficit: minutosParaHM(minutosContrato),
            tipo: 'faltante'
          });
        }
      }
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  const hojeCalculo = new Date();
  let diasPagos = 0;
  let dataAux = new Date(dataInicio);
  const minutoContratoPorDia = hmParaMinutos(estado.configuracoes.horasContrato) || 0;
  // Dias pagos = dias úteis pela escala OU folga, nunca feriado
  while (dataAux <= hojeCalculo) {
    const iso = dataAux.toISOString().slice(0, 10);
    const chave = chaveMes(dataAux);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
    const escalaTrabalho = estado.configuracoes.escalaTrabalho;
    const deveTrabalhar = deveSerDiaUtil(dataAux, escalaTrabalho);
    const isFolga = registro.isHoliday || registro.isFolga;
    const isFeriado = registro.isDayOff || registro.isFeriado;
    if ((deveTrabalhar || isFolga) && !isFeriado) {
      diasPagos++;
    }
    dataAux.setDate(dataAux.getDate() + 1);
  }
  // Descontar dias com atestado do esperado
  let diasAtestadoEsperado = 0;
  dataAux = new Date(dataInicio);
  while (dataAux <= hojeCalculo) {
    const iso = dataAux.toISOString().slice(0, 10);
    const chave = chaveMes(dataAux);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
    if ((registro.isSickLeave || registro.isAtestado) && (registro.sickLeaveStart || registro.inicioAtestado) && (registro.sickLeaveEnd || registro.fimAtestado)) {
      diasAtestadoEsperado++;
    }
    dataAux.setDate(dataAux.getDate() + 1);
  }
  const esperadoCorrigido = (diasPagos - diasAtestadoEsperado) * minutoContratoPorDia;
    totalDiasUteisEl.textContent = diasUteisPassados; // Atualizar o resumo do período com os valores realmente usados no cálculo
  const diasUteisRestantes = obterDiasUteisRestantes(hojeCalculo, dataFim);
  // Removido: saldo duplicado
  let necessarioDiario = 0;

  // Corrigir cálculo: folgas não compensadas devem ser consideradas como débito
  // Contar quantas folgas (dias marcados como isFolga) existem até hoje
  let dataAuxFolga = new Date(dataInicio);
  let folgasNaoCompensadas = 0;
  while (dataAuxFolga <= hoje) {
    const iso = dataAuxFolga.toISOString().slice(0, 10);
    const chave = chaveMes(dataAuxFolga);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
    if (registro.isHoliday || registro.isFolga) {
      folgasNaoCompensadas++;
    }
    dataAuxFolga.setDate(dataAuxFolga.getDate() + 1);
  }
  // O esperado deve ser: (diasUteisPassados) * minutoContratoPorDia
  // O saldo deve ser: soma - esperado
  const esperado = diasUteisPassados * minutoContratoPorDia;
  const saldo = soma - esperado;
  console.log(`[PERÍODO] ${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}`);
  console.log(`  Dias úteis: ${diasUteisPassados + diasUteisRestantes} | Trabalhados: ${diasTrabalhados} | Esperado: ${minutosParaHM(esperado)} | Real: ${minutosParaHM(soma)} | Saldo: ${minutosParaHM(saldo)}`);

  console.log(`[ANÁLISE POR DIA]`);
  let dataLog = new Date(dataInicio);
  while (dataLog <= dataFim && dataLog <= hoje) {
    const isoLog = dataLog.toISOString().slice(0, 10);
    const chaveLog = chaveMes(dataLog);
    const registroLog = (estado.dados[chaveLog] && estado.dados[chaveLog][isoLog]) || {};
    const nomeDia = dataLog.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

    if (registroLog.isHoliday || registroLog.isFolga) {
      console.log(`  ${nomeDia}: ${registroLog.isDayOff || registroLog.isFeriado ? 'FERIADO' : 'FOLGA'}`);
    } else if (deveSerDiaUtil(dataLog, estado.configuracoes.escalaTrabalho)) {
      const minsLog = calcularMinutosTrabalhados(registroLog);
      const minutosContrato = hmParaMinutos(estado.configuracoes.horasContrato) || 525;

      if (minsLog !== null) {
        const diff = minsLog - minutosContrato;
        let status = '';
        if (diff > 0) status = ` | EXTRA: ${minutosParaHM(diff)}`;
        else if (diff < 0) status = ` | DÉFICIT: ${minutosParaHM(Math.abs(diff))}`;

        const horarios = (registroLog.in || registroLog.entrada) && (registroLog.out || registroLog.saida) ?
          `${registroLog.in || registroLog.entrada}-${registroLog.out || registroLog.saida}` :
          'Horários incompletos';

        console.log(`  ${nomeDia}: ${horarios} = ${minutosParaHM(minsLog)}${status}`);

        if ((registroLog.isSickLeave || registroLog.isAtestado) && (registroLog.sickLeaveStart || registroLog.inicioAtestado) && (registroLog.sickLeaveEnd || registroLog.fimAtestado)) {
          console.log(`    Atestado: ${registroLog.sickLeaveStart || registroLog.inicioAtestado}-${registroLog.sickLeaveEnd || registroLog.fimAtestado}`);
        }
        if (registroLog.note || registroLog.observacao) {
          console.log(`    Obs: ${registroLog.note || registroLog.observacao}`);
        }
      } else {
        console.log(`  ${nomeDia}: NÃO TRABALHADO | FALTA: ${minutosParaHM(minutosContrato)}`);
      }
    }

    dataLog.setDate(dataLog.getDate() + 1);
  }

  let diasAtestado = 0;
  dataAtual = new Date(dataInicio);
  while (dataAtual <= dataFim) {
    const iso = dataAtual.toISOString().slice(0, 10);
    const chave = chaveMes(dataAtual);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
    if (registro.isSickLeave || registro.isAtestado) diasAtestado++;
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  if (diasAtestado > 0) {
    console.log(`[ATESTADOS] ${diasAtestado} dias com atestado médico no período`);
  }

  console.log(`[RESUMO FINAL]`);
  console.log(`  Escala: ${estado.configuracoes.escalaTrabalho} | Horas/dia: ${estado.configuracoes.horasContrato} | Tolerância: ${estado.configuracoes.arredondamento}`);
  console.log(`  Trabalhados: ${diasTrabalhados}/${diasUteisPassados} dias | Restantes: ${diasUteisRestantes} dias`);
  console.log(`  Folgas não compensadas: ${folgasNaoCompensadas}`);
  console.log(`  Saldo atual: ${minutosParaHM(saldo)} ${saldo >= 0 ? '(crédito)' : '(débito)'}`);

  if (diasUteisRestantes > 0) {
    let folgasCompensarFuturas = 0;
    let dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 1);

    while (dataFutura <= obterPeriodoCicloTrabalho().dataFim) {
      const iso = dataFutura.toISOString().slice(0, 10);
      const chave = chaveMes(dataFutura);
      const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};

      if ((registro.isHoliday || registro.isFolga) && deveSerDiaUtil(dataFutura, estado.configuracoes.escalaTrabalho)) {
        folgasCompensarFuturas++;
      }
      dataFutura.setDate(dataFutura.getDate() + 1);
    }

    const horasRestantesRegulares = diasUteisRestantes * minutoContratoPorDia;
    const horasCompensacao = folgasCompensarFuturas * minutoContratoPorDia;
    const totalEsperadoAteAgora = diasUteisPassados * minutoContratoPorDia;
    const saldoAtual = soma - totalEsperadoAteAgora;
    const horasRestantesContrato = horasRestantesRegulares + horasCompensacao - saldoAtual;
    necessarioDiario = horasRestantesContrato / diasUteisRestantes;

    if (saldo < 0) {
      console.log('Atrasado:', {
        horasRestantesRegulares: horasRestantesRegulares,
        folgasCompensarFuturas: folgasCompensarFuturas,
        horasCompensacao: horasCompensacao,
        saldoAtual: saldoAtual,
        horasRestantesContrato: horasRestantesContrato,
        diasUteisRestantes: diasUteisRestantes,
        necessarioDiario: necessarioDiario,
        necessarioDiarioHM: minutosParaHM(Math.round(necessarioDiario))
      });
    } else {
      console.log('No prazo ou adiantado:', {
        horasRestantesRegulares: horasRestantesRegulares,
        folgasCompensarFuturas: folgasCompensarFuturas,
        horasCompensacao: horasCompensacao,
        saldoAtual: saldoAtual,
        horasRestantesContrato: horasRestantesContrato,
        diasUteisRestantes: diasUteisRestantes,
        necessarioDiario: necessarioDiario,
        necessarioDiarioHM: minutosParaHM(Math.round(necessarioDiario))
      });
    }
  }

  // Atualizar o resumo do período com os valores realmente usados no cálculo
  totalEsperadoEl.textContent = minutosParaHM(esperado);
  totalTrabalhadoEl.textContent = minutosParaHM(soma);
  saldoEl.textContent = minutosParaHM(saldo);
  necessarioDiarioEl.textContent = diasUteisRestantes > 0 ? minutosParaHM(Math.round(necessarioDiario)) : "0h00";
}

function obterDiasUteisPassados(dataInicio, dataFim) {
  if (dataInicio > dataFim) {
    return 0;
  }
  const escalaTrabalho = estado.configuracoes.escalaTrabalho;
  let dias = 0;
  let data = new Date(dataInicio);
  while (data <= dataFim) {
    const iso = data.toISOString().slice(0, 10);
    const chave = chaveMes(data);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
    const deveTrabalhar = deveSerDiaUtil(data, escalaTrabalho);
    const isFolga = registro.isHoliday || registro.isFolga;
    const isFeriado = registro.isDayOff || registro.isFeriado;
    if ((deveTrabalhar || isFolga) && !isFeriado) {
      dias++;
    }
    data.setDate(data.getDate() + 1);
  }
  return dias;
}

function obterDiasUteisRestantes(deData, dataFim) {
  if (deData > dataFim) return 0;

  const escalaTrabalho = estado.configuracoes.escalaTrabalho;
  let diasRestantes = 0;
  let dataAtual = new Date(deData);

  dataAtual.setDate(dataAtual.getDate() + 1);

  console.log('Dias úteis restantes:', {
    deData: deData.toISOString().slice(0, 10),
    dataFim: dataFim.toISOString().slice(0, 10),
    iniciandoDe: dataAtual.toISOString().slice(0, 10),
    escalaTrabalho: escalaTrabalho
  });

  let folgasEncontradas = 0;

  while (dataAtual <= dataFim) {
    const iso = dataAtual.toISOString().slice(0, 10);
    const chave = chaveMes(dataAtual);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};

    if (registro.isDayOff || registro.isFeriado) {
      console.log('Pulando feriado:', iso);
      dataAtual.setDate(dataAtual.getDate() + 1);
      continue;
    }

    if ((registro.in || registro.entrada) && (registro.out || registro.saida) || registro.isSickLeave || registro.isAtestado) {
      console.log('Pulando dia já trabalhado/atestado:', iso);
      dataAtual.setDate(dataAtual.getDate() + 1);
      continue;
    }

    if (escalaTrabalho === 'custom') {
      diasRestantes++;
      console.log('Dia escala personalizada:', iso);
    } else {
      const deveTrabalhar = deveSerDiaUtil(dataAtual, escalaTrabalho);

      console.log('Verificação escala:', {
        data: iso,
        diaSemana: dataAtual.getDay(),
        nomeDia: dataAtual.toLocaleDateString('pt-BR', { weekday: 'short' }),
        escalaTrabalho: escalaTrabalho,
        deveTrabalhar: deveTrabalhar,
        eFolga: !!(registro.isHoliday || registro.isFolga)
      });

      if (deveTrabalhar && !registro.isHoliday && !registro.isFolga) {
        diasRestantes++;
      } else if (!deveTrabalhar && (registro.isHoliday || registro.isFolga)) {
        folgasEncontradas++;
        console.log('Folga em fim de semana - sem impacto:', iso);
      } else if (deveTrabalhar && (registro.isHoliday || registro.isFolga)) {
        folgasEncontradas++;
        console.log('Folga em dia útil - REDUZ dias disponíveis:', iso);
      }
    }

    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  console.log('Total dias úteis restantes:', diasRestantes);
  console.log('Folgas encontradas que precisam compensação:', folgasEncontradas);
  return diasRestantes;
}

function obterDiasUteisCiclo() {
  const { dataInicio, dataFim } = obterPeriodoCicloTrabalho();
  const escalaTrabalho = estado.configuracoes.escalaTrabalho;

  if (escalaTrabalho === 'custom') {
    let diasUteis = 0;
    let dataAtual = new Date(dataInicio);

    while (dataAtual <= dataFim) {
      const iso = dataAtual.toISOString().slice(0, 10);
      const chave = chaveMes(dataAtual);
      const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
      if (!registro.isDayOff && !registro.isFeriado) {
        diasUteis++;
      }
      dataAtual.setDate(dataAtual.getDate() + 1);
    }
    return diasUteis;
  }

  const [diasTrabalho, diasDescanso] = escalaTrabalho.split('x').map(Number);
  const diasCiclo = diasTrabalho + diasDescanso;

  let totalDiasUteis = 0;
  let dataAtual = new Date(dataInicio);

  while (dataAtual <= dataFim) {
    const iso = dataAtual.toISOString().slice(0, 10);
    const chave = chaveMes(dataAtual);
    const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};

    if (registro.isDayOff || registro.isFeriado) {
      dataAtual.setDate(dataAtual.getDate() + 1);
      continue;
    }

    const deveTrabalhar = deveSerDiaUtil(dataAtual, escalaTrabalho);

    if (deveTrabalhar) {
      totalDiasUteis++;
    }

    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  return totalDiasUteis;
}

document.addEventListener('DOMContentLoaded', () => {
  checkFolga.addEventListener('change', () => {
    if (checkFolga.checked) {
      checkFeriado.checked = false;
    }
    alternarCamposHorario();
  });

  checkFeriado.addEventListener('change', () => {
    if (checkFeriado.checked) {
      checkFolga.checked = false;
    }
    alternarCamposHorario();
  });

  const checkAtestado = document.getElementById('modalIsSickLeave');
  checkAtestado.addEventListener('change', () => {
    alternarCamposHorario();
    alternarCamposAtestado();
  });

  document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });

  document.getElementById('saveDay').addEventListener('click', () => {
    const checkAtestado = document.getElementById('modalIsSickLeave');
    const eAtestado = checkAtestado.checked;
    const inicioAtestado = document.getElementById('modalSickLeaveStart').value;
    const fimAtestado = document.getElementById('modalSickLeaveEnd').value;

    // Obter valores dos campos
    let entrada = (checkFolga.checked || checkFeriado.checked) ? null : (horarioEntrada.value || null);
    let saidaAlmoco = (checkFolga.checked || checkFeriado.checked) ? null : (horarioSaidaAlmoco.value || null);
    let voltaAlmoco = (checkFolga.checked || checkFeriado.checked) ? null : (horarioVoltaAlmoco.value || null);
    let saida = (checkFolga.checked || checkFeriado.checked) ? null : (horarioSaida.value || null);

    // Se algum campo de horário foi preenchido, preencher os outros com padrão se estiverem vazios
    if (!(checkFolga.checked || checkFeriado.checked)) {
      const entradaPadrao = estado.configuracoes.entradaPadrao || '08:00';
      const saidaAlmocoPadrao = estado.configuracoes.saidaAlmocoPadrao || '12:00';
      const voltaAlmocoPadrao = estado.configuracoes.voltaAlmocoPadrao || '13:00';
      const saidaPadrao = estado.configuracoes.saidaPadrao || '17:45';
      const algumPreenchido = entrada || saidaAlmoco || voltaAlmoco || saida;
      if (algumPreenchido) {
        if (!entrada) entrada = entradaPadrao;
        if (!saidaAlmoco) saidaAlmoco = saidaAlmocoPadrao;
        if (!voltaAlmoco) voltaAlmoco = voltaAlmocoPadrao;
        if (!saida) saida = saidaPadrao;
      }
    }

    const obj = {
      entrada,
      saidaAlmoco,
      voltaAlmoco,
      saida,
      observacao: observacao.value || '',
      isFolga: checkFolga.checked,
      isFeriado: checkFeriado.checked,
      isAtestado: eAtestado,
      inicioAtestado: eAtestado ? inicioAtestado : null,
      fimAtestado: eAtestado ? fimAtestado : null
    };
    if (!estado.dados[chaveEdicaoAtual]) estado.dados[chaveEdicaoAtual] = {};
    estado.dados[chaveEdicaoAtual][isoEdicaoAtual] = obj;
    modal.style.display = 'none';
    renderizarCalendario();
  });

  document.getElementById('deleteDay').addEventListener('click', () => {
    if (estado.dados[chaveEdicaoAtual] && estado.dados[chaveEdicaoAtual][isoEdicaoAtual]) {
      delete estado.dados[chaveEdicaoAtual][isoEdicaoAtual];
    }
    modal.style.display = 'none';
    renderizarCalendario();
  });

  document.getElementById('prevMonth').addEventListener('click', () => { estado.deslocamentoMes--; renderizarCalendario(); });
  document.getElementById('nextMonth').addEventListener('click', () => { estado.deslocamentoMes++; renderizarCalendario(); });

  const selArredondamento = document.getElementById('rounding');
  selArredondamento.addEventListener('change', () => {
    estado.configuracoes.arredondamento = selArredondamento.value;
    recalcularTotais();
    salvarArmazenamento();
  });

  const selEscalaTrabalho = document.getElementById('workSchedule');
  selEscalaTrabalho.addEventListener('change', () => {
    estado.configuracoes.escalaTrabalho = selEscalaTrabalho.value;
    recalcularTotais();
    salvarArmazenamento();
  });

  const inputDiaInicioCiclo = document.getElementById('cycleStartDay');
  inputDiaInicioCiclo.addEventListener('input', () => {
    const valor = parseInt(inputDiaInicioCiclo.value) || 25;
    estado.configuracoes.diaInicioCiclo = Math.max(1, Math.min(31, valor));
    renderizarCalendario();
    salvarArmazenamento();
  });

  const inputEntradaPadrao = document.getElementById('standardEntry');
  const inputSaidaAlmocoPadrao = document.getElementById('standardLunchOut');
  const inputVoltaAlmocoPadrao = document.getElementById('standardLunchIn');
  const inputSaidaPadrao = document.getElementById('standardExit');

  function atualizarHorariosPadrao() {
    estado.configuracoes.entradaPadrao = inputEntradaPadrao.value || '08:00';
    estado.configuracoes.saidaAlmocoPadrao = inputSaidaAlmocoPadrao.value || '12:00';
    estado.configuracoes.voltaAlmocoPadrao = inputVoltaAlmocoPadrao.value || '13:00';
    estado.configuracoes.saidaPadrao = inputSaidaPadrao.value || '17:45';

    calcularHorasContrato();
    recalcularTotais();
    salvarArmazenamento();
  }

  inputEntradaPadrao.addEventListener('change', atualizarHorariosPadrao);
  inputSaidaAlmocoPadrao.addEventListener('change', atualizarHorariosPadrao);
  inputVoltaAlmocoPadrao.addEventListener('change', atualizarHorariosPadrao);
  inputSaidaPadrao.addEventListener('change', atualizarHorariosPadrao);

  document.getElementById('exportJson').addEventListener('click', () => {
    const dados = { dados: estado.dados, configuracoes: estado.configuracoes };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calcHoras_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importJson').addEventListener('click', () => document.getElementById('fileInput').click());

  document.getElementById('fileInput').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const obj = JSON.parse(leitor.result);
        if (!obj || typeof obj !== 'object') {
          throw new Error('O arquivo não contém um objeto JSON válido.');
        }

        // Aceita tanto dados/settings quanto dados/configuracoes
        let dadosImportados = obj.dados || obj.data;
        let configImportada = obj.configuracoes || obj.settings;

        if (!dadosImportados && !configImportada) {
          throw new Error('O arquivo não possui dados ou configurações reconhecidos.');
        }


        if (dadosImportados) {
          // Converte todos os registros para o padrão em português
          const traduzirRegistro = (reg) => {
            if (!reg) return reg;
            // Pega os horários padrão atuais
            const padrao = estado.configuracoes || {};
            const entradaPadrao = padrao.entradaPadrao || '08:00';
            const saidaAlmocoPadrao = padrao.saidaAlmocoPadrao || '12:00';
            const voltaAlmocoPadrao = padrao.voltaAlmocoPadrao || '13:00';
            const saidaPadrao = padrao.saidaPadrao || '17:45';

            // Pega valores do registro ou do padrão
            let entrada = reg.entrada ?? reg.in ?? '';
            let saidaAlmoco = reg.saidaAlmoco ?? reg.outLunch ?? '';
            let voltaAlmoco = reg.voltaAlmoco ?? reg.inLunch ?? '';
            let saida = reg.saida ?? reg.out ?? '';

            // Se algum horário está preenchido, preenche os outros com padrão
            const algumPreenchido = entrada || saidaAlmoco || voltaAlmoco || saida;
            if (algumPreenchido) {
              if (!entrada) entrada = entradaPadrao;
              if (!saidaAlmoco) saidaAlmoco = saidaAlmocoPadrao;
              if (!voltaAlmoco) voltaAlmoco = voltaAlmocoPadrao;
              if (!saida) saida = saidaPadrao;
            }

            return {
              entrada,
              saidaAlmoco,
              voltaAlmoco,
              saida,
              observacao: reg.observacao ?? reg.note ?? '',
              isFolga: reg.isFolga ?? reg.isHoliday ?? false,
              isFeriado: reg.isFeriado ?? reg.isDayOff ?? false,
              isAtestado: reg.isAtestado ?? reg.isSickLeave ?? false,
              inicioAtestado: reg.inicioAtestado ?? reg.sickLeaveStart ?? '',
              fimAtestado: reg.fimAtestado ?? reg.sickLeaveEnd ?? ''
            };
          };
          const dadosConvertidos = {};
          for (const chaveMes in dadosImportados) {
            dadosConvertidos[chaveMes] = {};
            for (const dia in dadosImportados[chaveMes]) {
              dadosConvertidos[chaveMes][dia] = traduzirRegistro(dadosImportados[chaveMes][dia]);
            }
          }
          estado.dados = dadosConvertidos;
          console.log('Dados de horas importados:', Object.keys(estado.dados).length, 'meses');
        }

        if (configImportada) {
          const c = configImportada;
          estado.configuracoes = {
            horasContrato: c.horasContrato || c.contractHours || '8h45',
            arredondamento: c.arredondamento || c.rounding || 'threshold10',
            escalaTrabalho: c.escalaTrabalho || c.workSchedule || '5x2',
            diaInicioCiclo: c.diaInicioCiclo || c.cycleStartDay || 25,
            entradaPadrao: c.entradaPadrao || c.standardEntry || '08:00',
            saidaAlmocoPadrao: c.saidaAlmocoPadrao || c.standardLunchOut || '12:00',
            voltaAlmocoPadrao: c.voltaAlmocoPadrao || c.standardLunchIn || '13:00',
            saidaPadrao: c.saidaPadrao || c.standardExit || '17:45'
          };

          document.getElementById('rounding').value = estado.configuracoes.arredondamento;
          document.getElementById('workSchedule').value = estado.configuracoes.escalaTrabalho;
          document.getElementById('cycleStartDay').value = estado.configuracoes.diaInicioCiclo;

          const entrada = estado.configuracoes.entradaPadrao;
          const saidaAlmoco = estado.configuracoes.saidaAlmocoPadrao;
          const voltaAlmoco = estado.configuracoes.voltaAlmocoPadrao;
          const saida = estado.configuracoes.saidaPadrao;

          document.getElementById('standardEntry').value = entrada.includes('h') ? entrada.replace('h', ':').padStart(5, '0') : entrada;
          document.getElementById('standardLunchOut').value = saidaAlmoco.includes('h') ? saidaAlmoco.replace('h', ':').padStart(5, '0') : saidaAlmoco;
          document.getElementById('standardLunchIn').value = voltaAlmoco.includes('h') ? voltaAlmoco.replace('h', ':').padStart(5, '0') : voltaAlmoco;
          document.getElementById('standardExit').value = saida.includes('h') ? saida.replace('h', ':').padStart(5, '0') : saida;

          estado.configuracoes.entradaPadrao = document.getElementById('standardEntry').value;
          estado.configuracoes.saidaAlmocoPadrao = document.getElementById('standardLunchOut').value;
          estado.configuracoes.voltaAlmocoPadrao = document.getElementById('standardLunchIn').value;
          estado.configuracoes.saidaPadrao = document.getElementById('standardExit').value;

          calcularHorasContrato();
          console.log('Configurações importadas:', estado.configuracoes);
        }

        salvarArmazenamento();
        renderizarCalendario();
        alert('Dados importados com sucesso!');
      } catch (e) {
        console.error('Erro ao importar JSON:', e);
        alert(`Erro ao importar arquivo: ${e.message}\n\nO arquivo deve ter as propriedades "dados" e/ou "configuracoes" ou "data" e/ou "settings".`);
      }
    };
    leitor.readAsText(f);
  });

  document.getElementById('clearData').addEventListener('click', () => {
    if (confirm('Apagar todos os dados locais?')) {
      localStorage.removeItem(CHAVE_ARMAZENAMENTO);
      estado.dados = {};
      renderizarCalendario();
    }
  });

  document.getElementById('themeSelect').addEventListener('change', (e) => {
    const temaSelecionado = e.target.value;
    document.documentElement.setAttribute('data-theme', temaSelecionado);
    localStorage.setItem('theme', temaSelecionado);
  });

  const temaFavoritado = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', temaFavoritado);
  document.getElementById('themeSelect').value = temaFavoritado;

  carregarArmazenamento();
  
  if (typeof estado.configuracoes.horasContrato === 'number') {
    const horas = Math.floor(estado.configuracoes.horasContrato);
    const minutos = Math.round((estado.configuracoes.horasContrato - horas) * 60);
    estado.configuracoes.horasContrato = formatarNumero(horas) + ':' + formatarNumero(minutos);
  }

  document.getElementById('rounding').value = estado.configuracoes.arredondamento;
  document.getElementById('workSchedule').value = estado.configuracoes.escalaTrabalho;
  document.getElementById('cycleStartDay').value = estado.configuracoes.diaInicioCiclo;

  document.getElementById('standardEntry').value = estado.configuracoes.entradaPadrao;
  document.getElementById('standardLunchOut').value = estado.configuracoes.saidaAlmocoPadrao;
  document.getElementById('standardLunchIn').value = estado.configuracoes.voltaAlmocoPadrao;
  document.getElementById('standardExit').value = estado.configuracoes.saidaPadrao;

  calcularHorasContrato();
  renderizarCalendario();
});
