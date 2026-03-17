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
		dataInicio = new Date(
			mesVisualizado.getFullYear(),
			mesVisualizado.getMonth(),
			1
		);
		dataFim = new Date(
			mesVisualizado.getFullYear(),
			mesVisualizado.getMonth() + 1,
			0
		);
	} else {
		dataInicio = new Date(
			mesVisualizado.getFullYear(),
			mesVisualizado.getMonth() - 1,
			diaInicioCiclo
		);
		dataFim = new Date(
			mesVisualizado.getFullYear(),
			mesVisualizado.getMonth(),
			diaInicioCiclo - 1
		);
	}

	return { dataInicio, dataFim };
}

function deveSerDiaUtil(data, escalaTrabalho) {
	if (escalaTrabalho === "custom") return true;

	const [diasTrabalho, diasDescanso] = escalaTrabalho.split("x").map(Number);
	const diasCiclo = diasTrabalho + diasDescanso;

	if (escalaTrabalho === "5x2") {
		const diaSemana = data.getDay();
		return diaSemana >= 1 && diaSemana <= 5;
	}

	if (escalaTrabalho === "6x1") {
		const diaSemana = data.getDay();
		return diaSemana !== 0;
	}

	const diaAno = Math.floor(
		(data - new Date(data.getFullYear(), 0, 0)) / (24 * 60 * 60 * 1000)
	);
	const posicaoCiclo = (diaAno - 1) % diasCiclo;

	return posicaoCiclo < diasTrabalho;
}

function renderizarCalendario() {
	const { dataInicio, dataFim } = obterPeriodoCicloTrabalho();
	const diaInicioCiclo = estado.configuracoes.diaInicioCiclo || 25;

	if (diaInicioCiclo === 1) {
		rotuloMes.textContent = dataInicio.toLocaleString("pt-BR", {
			month: "long",
			year: "numeric",
		});
	} else {
		const mesInicio = dataInicio.toLocaleString("pt-BR", { month: "short" });
		const mesFim = dataFim.toLocaleString("pt-BR", {
			month: "short",
			year: "numeric",
		});
		rotuloMes.textContent = `${diaInicioCiclo} ${mesInicio} - ${dataFim.getDate()} ${mesFim}`;
	}

	const indiceInicio = dataInicio.getDay();
	const totalDiasCiclo =
		Math.floor((dataFim - dataInicio) / (24 * 60 * 60 * 1000)) + 1;

	containerDias.innerHTML = "";
	const totalCelulas = Math.ceil((indiceInicio + totalDiasCiclo) / 7) * 7;

	for (let i = 0; i < totalCelulas; i++) {
		const celula = document.createElement("div");
		celula.className = "day card";
		const deslocamento = i - indiceInicio;
		if (deslocamento < 0 || deslocamento >= totalDiasCiclo) {
			celula.classList.add("inactive");
			celula.classList.add("out-of-cycle");
			containerDias.appendChild(celula);
			continue;
		}
		const dataCelula = new Date(dataInicio);
		dataCelula.setDate(dataInicio.getDate() + deslocamento);

		const iso = dataCelula.toISOString().slice(0, 10);
		const num = document.createElement("div");
		num.className = "date-num";
		num.textContent = dataCelula.getDate();
		celula.appendChild(num);

		const resumo = document.createElement("div");
		resumo.className = "summary small";
		const chave = chaveMes(dataCelula);
		const dadosDia = (estado.dados[chave] && estado.dados[chave][iso]) || null;

		if (dadosDia) {
			if (dadosDia.isFolga) {
				resumo.textContent = "Folga";
				resumo.classList.add("folga-text");
				celula.classList.add("personal-day-off");
			} else if (dadosDia.isFeriado) {
				resumo.textContent = "Feriado";
				resumo.classList.add("feriado-text");
				celula.classList.add("holiday");
			} else {
				const minutos = calcularMinutosTrabalhados(dadosDia);

				const temAtestado =
					dadosDia.isAtestado &&
					dadosDia.inicioAtestado &&
					dadosDia.fimAtestado;
				const temTrabalhoRegular = dadosDia.entrada && dadosDia.saida;

				if (temAtestado && !temTrabalhoRegular) {
					resumo.textContent = "Atestado Médico";
					resumo.classList.add("atestado-text");
					celula.classList.add("sick-leave");

					const infoHorario = document.createElement("div");
					infoHorario.className = "small info-horario-atestado";
					infoHorario.textContent = `${dadosDia.inicioAtestado} - ${dadosDia.fimAtestado}`;
					resumo.appendChild(infoHorario);
				} else if (temAtestado && temTrabalhoRegular) {
					celula.classList.add("sick-leave");
					if (minutos !== null) {
						resumo.textContent = minutosParaHM(minutos);

						const infoAtestado = document.createElement("div");
						infoAtestado.className = "small info-atestado-extra";
						infoAtestado.textContent = `+ Atestado ${dadosDia.inicioAtestado}-${dadosDia.fimAtestado}`;
						resumo.appendChild(infoAtestado);
					}
				} else if (temTrabalhoRegular) {
					if (minutos !== null) {
						resumo.textContent = minutosParaHM(minutos);

						const minutosContrato =
							hmParaMinutos(estado.configuracoes.horasContrato) || 525;
						if (minutos > minutosContrato) {
							const minutosExtras = minutos - minutosContrato;
							celula.classList.add("overtime");
							const indicadorExtra = document.createElement("div");
							indicadorExtra.className = "small indicador-extra";
							indicadorExtra.textContent = `+${minutosParaHM(minutosExtras)}`;
							resumo.appendChild(indicadorExtra);
						}
					}
				}

				const hoje = new Date();
				if (dataCelula < hoje) {
					const minutosContrato =
						hmParaMinutos(estado.configuracoes.horasContrato) || 525;
					const deveTrabalhar = deveSerDiaUtil(
						dataCelula,
						estado.configuracoes.escalaTrabalho
					);

					if (deveTrabalhar && !dadosDia.isFolga) {
						if (minutos === null) {
							celula.classList.add("deficit");
							const indicadorDeficit = document.createElement("div");
							indicadorDeficit.className = "small indicador-deficit";
							indicadorDeficit.textContent = "❌ Não trabalhado";
							resumo.appendChild(indicadorDeficit);
						} else if (minutos < minutosContrato) {
							const deficit = minutosContrato - minutos;
							celula.classList.add("deficit");
							const indicadorDeficit = document.createElement("div");
							indicadorDeficit.className = "small indicador-deficit";
							indicadorDeficit.textContent = `-${minutosParaHM(deficit)}`;
							resumo.appendChild(indicadorDeficit);
						}
					}
				}

				if (
					temTrabalhoRegular &&
					minutos !== null &&
					estado.configuracoes.arredondamento === "threshold10"
				) {
					const infoTolerancia = obterInfoTolerancia(dadosDia);
					if (infoTolerancia && infoTolerancia.toleranciaAplicada) {
						const indicadorTolerancia = document.createElement("div");
						indicadorTolerancia.className = "small indicador-tolerancia";
						indicadorTolerancia.textContent = `Real: ${minutosParaHM(
							infoTolerancia.bruto
						)}`;
						resumo.appendChild(indicadorTolerancia);
					}
				}
			}
		}
		celula.appendChild(resumo);

		celula.addEventListener("click", () => abrirModalPara(iso, dataCelula));
		containerDias.appendChild(celula);
	}

	recalcularTotais();
	salvarArmazenamento();
}
