function obterMesVisualizado() {
  const agora = new Date();
  agora.setDate(1);
  agora.setMonth(agora.getMonth() + estado.deslocamentoMes);
  return agora;
}

function obterPeriodoCicloTrabalho() {
  const diaInicioCiclo = estado.configuracoes.diaInicioCiclo || 25;
  const mesVisualizado = obterMesVisualizado();

  let dataInicio, dataFim;

  if (diaInicioCiclo === 1) {
    dataInicio = new Date(mesVisualizado.getFullYear(), mesVisualizado.getMonth(), 1);
    dataFim = new Date(mesVisualizado.getFullYear(), mesVisualizado.getMonth() + 1, 0);
  } else {
    dataInicio = new Date(mesVisualizado.getFullYear(), mesVisualizado.getMonth() - 1, diaInicioCiclo);
    dataFim = new Date(mesVisualizado.getFullYear(), mesVisualizado.getMonth(), diaInicioCiclo - 1);
  }

  return { dataInicio, dataFim };
}

function deveSerDiaUtil(data, escalaTrabalho) {
  if (escalaTrabalho === 'custom') return true;

  const [diasTrabalho, diasDescanso] = escalaTrabalho.split('x').map(Number);
  const diasCiclo = diasTrabalho + diasDescanso;

  if (escalaTrabalho === '5x2') {
    const diaSemana = data.getDay();
    return diaSemana >= 1 && diaSemana <= 5;
  }

  if (escalaTrabalho === '6x1') {
    const diaSemana = data.getDay();
    return diaSemana !== 0;
  }

  const diaAno = Math.floor((data - new Date(data.getFullYear(), 0, 0)) / (24 * 60 * 60 * 1000));
  const posicaoCiclo = (diaAno - 1) % diasCiclo;

  return posicaoCiclo < diasTrabalho;
}

function renderizarCalendario() {
  const { dataInicio, dataFim } = obterPeriodoCicloTrabalho();
  const diaInicioCiclo = estado.configuracoes.diaInicioCiclo || 25;

  if (diaInicioCiclo === 1) {
    rotuloMes.textContent = dataInicio.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  } else {
    const mesInicio = dataInicio.toLocaleString('pt-BR', { month: 'short' });
    const mesFim = dataFim.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
    rotuloMes.textContent = `${diaInicioCiclo} ${mesInicio} - ${dataFim.getDate()} ${mesFim}`;
  }

  const primeiro = obterMesVisualizado();
  const ano = primeiro.getFullYear();
  const mes = primeiro.getMonth();

  const diaInicio = new Date(ano, mes, 1);
  const indiceInicio = diaInicio.getDay();
  const ultimoDiaAnterior = new Date(ano, mes, 0).getDate();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  containerDias.innerHTML = '';
  const totalCelulas = Math.ceil((indiceInicio + diasNoMes) / 7) * 7;
  let contadorDia = 1;
  let contadorProximoMes = 1;

  for (let i = 0; i < totalCelulas; i++) {
    const celula = document.createElement('div');
    celula.className = 'day card';
    let dataCelula = null;
    let inativo = false;

    if (i < indiceInicio) {
      const d = ultimoDiaAnterior - (indiceInicio - 1 - i);
      const dataAnterior = new Date(ano, mes - 1, d);
      dataCelula = dataAnterior;
      inativo = true;
      celula.classList.add('inactive');
    } else if (contadorDia <= diasNoMes) {
      dataCelula = new Date(ano, mes, contadorDia);
      contadorDia++;
    } else {
      const proximo = new Date(ano, mes + 1, contadorProximoMes++);
      dataCelula = proximo;
      inativo = true;
      celula.classList.add('inactive');
    }

    const estaNoCiclo = dataCelula >= dataInicio && dataCelula <= dataFim;
    if (!estaNoCiclo && diaInicioCiclo !== 1) {
      celula.style.opacity = '0.3';
      celula.style.border = '1px dashed #ddd';
    }

    const iso = dataCelula.toISOString().slice(0, 10);
    const num = document.createElement('div');
    num.className = 'date-num';
    num.textContent = dataCelula.getDate();
    celula.appendChild(num);

    const resumo = document.createElement('div');
    resumo.className = 'summary small';
    const chave = chaveMes(dataCelula);
    const dadosDia = (estado.dados[chave] && estado.dados[chave][iso]) || null;
    
    if (dadosDia) {
      if (dadosDia.isFolga) {
        resumo.textContent = 'Folga';
        resumo.style.color = '#f59e0b';
        resumo.style.fontWeight = '500';
        celula.classList.add('personal-day-off');
      } else if (dadosDia.isFeriado) {
        resumo.textContent = 'Feriado';
        resumo.style.color = '#e11d48';
        resumo.style.fontWeight = '500';
        celula.classList.add('holiday');
      } else {
        const minutos = calcularMinutosTrabalhados(dadosDia);

        const temAtestado = dadosDia.isAtestado && dadosDia.inicioAtestado && dadosDia.fimAtestado;
        const temTrabalhoRegular = dadosDia.entrada && dadosDia.saida;

        if (temAtestado && !temTrabalhoRegular) {
          resumo.textContent = 'Atestado Médico';
          resumo.style.color = '#f59e0b';
          resumo.style.fontWeight = '500';
          celula.classList.add('sick-leave');

          const infoHorario = document.createElement('div');
          infoHorario.className = 'small';
          infoHorario.style.fontSize = '11px';
          infoHorario.style.color = '#92400e';
          infoHorario.style.marginTop = '2px';
          infoHorario.textContent = `${dadosDia.inicioAtestado} - ${dadosDia.fimAtestado}`;
          resumo.appendChild(infoHorario);
        } else if (temAtestado && temTrabalhoRegular) {
          celula.classList.add('sick-leave');
          if (minutos !== null) {
            resumo.textContent = minutosParaHM(minutos);

            const infoAtestado = document.createElement('div');
            infoAtestado.className = 'small';
            infoAtestado.style.fontSize = '10px';
            infoAtestado.style.color = '#f59e0b';
            infoAtestado.style.marginTop = '2px';
            infoAtestado.textContent = `+ Atestado ${dadosDia.inicioAtestado}-${dadosDia.fimAtestado}`;
            resumo.appendChild(infoAtestado);
          }
        } else if (temTrabalhoRegular) {
          if (minutos !== null) {
            resumo.textContent = minutosParaHM(minutos);

            const minutosContrato = hmParaMinutos(estado.configuracoes.horasContrato) || 525;
            if (minutos > minutosContrato) {
              const minutosExtras = minutos - minutosContrato;
              celula.classList.add('overtime');
              const indicadorExtra = document.createElement('div');
              indicadorExtra.className = 'small';
              indicadorExtra.style.fontSize = '10px';
              indicadorExtra.style.color = '#059669';
              indicadorExtra.style.marginTop = '2px';
              indicadorExtra.style.fontWeight = '500';
              indicadorExtra.textContent = `+${minutosParaHM(minutosExtras)}`;
              resumo.appendChild(indicadorExtra);
            }
          }
        }

        const hoje = new Date();
        if (dataCelula < hoje && !inativo) {
          const minutosContrato = hmParaMinutos(estado.configuracoes.horasContrato) || 525;
          const deveTrabalhar = deveSerDiaUtil(dataCelula, estado.configuracoes.escalaTrabalho);

          if (deveTrabalhar && !dadosDia.isFolga) {
            if (minutos === null) {
              celula.classList.add('deficit');
              const indicadorDeficit = document.createElement('div');
              indicadorDeficit.className = 'small';
              indicadorDeficit.style.fontSize = '10px';
              indicadorDeficit.style.color = '#dc2626';
              indicadorDeficit.style.marginTop = '2px';
              indicadorDeficit.style.fontWeight = '500';
              indicadorDeficit.textContent = '❌ Não trabalhado';
              resumo.appendChild(indicadorDeficit);
            } else if (minutos < minutosContrato) {
              const deficit = minutosContrato - minutos;
              celula.classList.add('deficit');
              const indicadorDeficit = document.createElement('div');
              indicadorDeficit.className = 'small';
              indicadorDeficit.style.fontSize = '10px';
              indicadorDeficit.style.color = '#dc2626';
              indicadorDeficit.style.marginTop = '2px';
              indicadorDeficit.style.fontWeight = '500';
              indicadorDeficit.textContent = `-${minutosParaHM(deficit)}`;
              resumo.appendChild(indicadorDeficit);
            }
          }
        }

        if (temTrabalhoRegular && minutos !== null && estado.configuracoes.arredondamento === 'threshold10') {
          const infoTolerancia = obterInfoTolerancia(dadosDia);
          if (infoTolerancia && infoTolerancia.toleranciaAplicada) {
            const indicadorTolerancia = document.createElement('div');
            indicadorTolerancia.className = 'small';
            indicadorTolerancia.style.fontSize = '10px';
            indicadorTolerancia.style.color = '#059669';
            indicadorTolerancia.style.marginTop = '2px';
            indicadorTolerancia.textContent = `Real: ${minutosParaHM(infoTolerancia.bruto)}`;
            resumo.appendChild(indicadorTolerancia);
          }
        }
      }
    }
    celula.appendChild(resumo);

    celula.addEventListener('click', () => abrirModalPara(iso, dataCelula, inativo));
    containerDias.appendChild(celula);
  }

  recalcularTotais();
  salvarArmazenamento();
}
