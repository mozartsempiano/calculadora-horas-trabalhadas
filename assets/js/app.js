const estado = {
	deslocamentoMes: 0,
	dados: {},
	configuracoes: {
		horasContrato: "8h45",
		arredondamento: "threshold10",
		escalaTrabalho: "5x2",
		diaInicioCiclo: 25,
		entradaPadrao: "08:00",
		saidaAlmocoPadrao: "12:00",
		voltaAlmocoPadrao: "13:00",
		saidaPadrao: "17:45",
	},
};

const CHAVE_ARMAZENAMENTO = "calcHoras:v1";

function carregarArmazenamento() {
	const dados = localStorage.getItem(CHAVE_ARMAZENAMENTO);
	if (dados)
		try {
			const obj = JSON.parse(dados);
			estado.dados = obj.dados || {};

			if (obj.configuracoes) {
				const config = obj.configuracoes;
				estado.configuracoes = {
					horasContrato: config.horasContrato || "8h45",
					arredondamento: config.arredondamento || "threshold10",
					escalaTrabalho: config.escalaTrabalho || "5x2",
					diaInicioCiclo: config.diaInicioCiclo || 25,
					entradaPadrao: config.entradaPadrao || "08:00",
					saidaAlmocoPadrao:
						config.saidaAlmocoPadrao || "12:00",
					voltaAlmocoPadrao: config.voltaAlmocoPadrao || "13:00",
					saidaPadrao: config.saidaPadrao || "17:45",
				};
			}
		} catch (e) {}
}

function salvarArmazenamento() {
	localStorage.setItem(
		CHAVE_ARMAZENAMENTO,
		JSON.stringify({
			dados: estado.dados,
			configuracoes: estado.configuracoes,
		})
	);
}

const rotuloMes = document.getElementById("monthLabel");
const containerDias = document.getElementById("days");
const totalDiasUteisEl = document.getElementById("workDaysTotal");
const totalEsperadoEl = document.getElementById("expectedTotal");
const totalTrabalhadoEl = document.getElementById("workedTotal");
const saldoEl = document.getElementById("balance");
const necessarioDiarioEl = document.getElementById("dailyNeeded");

const modal = document.getElementById("modal");
const horarioEntrada = document.getElementById("inTime");
const horarioSaidaAlmoco = document.getElementById("outLunch");
const horarioVoltaAlmoco = document.getElementById("inLunch");
const horarioSaida = document.getElementById("outTime");
const observacao = document.getElementById("note");
const checkFolga = document.getElementById("isHoliday");
const checkFeriado = document.getElementById("isDayOff");
let chaveEdicaoAtual = null;
let isoEdicaoAtual = null;

function abrirModalPara(iso, objData) {
	isoEdicaoAtual = iso;
	chaveEdicaoAtual = chaveMes(objData);
	document.getElementById("modalTitle").textContent =
		"Editar: " +
		objData.toLocaleDateString("pt-BR", {
			weekday: "long",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

	const registro = (estado.dados[chaveEdicaoAtual] || {})[iso] || {};
	horarioEntrada.value = registro.in || registro.entrada || "";
	horarioSaidaAlmoco.value = registro.outLunch || registro.saidaAlmoco || "";
	horarioVoltaAlmoco.value = registro.inLunch || registro.voltaAlmoco || "";
	horarioSaida.value = registro.out || registro.saida || "";
	observacao.value = registro.note || registro.observacao || "";
	checkFolga.checked = registro.isHoliday || registro.isFolga || false;
	checkFeriado.checked = registro.isDayOff || registro.isFeriado || false;

	const checkAtestado = document.getElementById("modalIsSickLeave");
	const inicioAtestado = document.getElementById("modalSickLeaveStart");
	const fimAtestado = document.getElementById("modalSickLeaveEnd");

	checkAtestado.checked = registro.isSickLeave || registro.isAtestado || false;
	inicioAtestado.value =
		registro.sickLeaveStart || registro.inicioAtestado || "";
	fimAtestado.value = registro.sickLeaveEnd || registro.fimAtestado || "";

	alternarCamposHorario();
	alternarCamposAtestado();

	modal.classList.add("show");
}

function alternarCamposHorario() {
	const container = document.querySelector(".time-fields-container");
	const eFolga = checkFolga.checked;
	const eFeriado = checkFeriado.checked;

	if (container) {
		if (eFolga || eFeriado) {
			container.classList.add("hidden");
		} else {
			container.classList.remove("hidden");
		}
	}
}

function alternarCamposAtestado() {
	const camposAtestado = document.getElementById("sick-leave-time");
	const checkAtestado = document.getElementById("modalIsSickLeave");
	const eAtestado = checkAtestado.checked;

	if (eAtestado) {
		camposAtestado.classList.remove("hidden");
	} else {
		camposAtestado.classList.add("hidden");
	}
}

function calcularHorasContrato() {
	const entrada = hmParaMinutos(estado.configuracoes.entradaPadrao);
	const saidaAlmoco = hmParaMinutos(estado.configuracoes.saidaAlmocoPadrao);
	const voltaAlmoco = hmParaMinutos(estado.configuracoes.voltaAlmocoPadrao);
	const saida = hmParaMinutos(estado.configuracoes.saidaPadrao);

	if (entrada !== null && saida !== null) {
		let totalMinutos = saida - entrada;

		if (
			saidaAlmoco !== null &&
			voltaAlmoco !== null &&
			voltaAlmoco > saidaAlmoco
		) {
			const intervaloAlmoco = voltaAlmoco - saidaAlmoco;
			totalMinutos -= intervaloAlmoco;
		}

		const horasCalculadas = minutosParaHM(totalMinutos);
		estado.configuracoes.horasContrato = horasCalculadas;
		document.getElementById("calculatedHours").textContent = horasCalculadas;

		return horasCalculadas;
	}

	return "8h45";
}

function calcularMinutosTrabalhados(registro, aplicarTolerancia = true) {
	if (
		registro.isHoliday ||
		registro.isFolga ||
		registro.isDayOff ||
		registro.isFeriado
	)
		return 0;
	let atestadoInicio = null,
		atestadoFim = null;
	if (
		(registro.isSickLeave || registro.isAtestado) &&
		(registro.sickLeaveStart || registro.inicioAtestado) &&
		(registro.sickLeaveEnd || registro.fimAtestado)
	) {
		atestadoInicio = hmParaMinutos(
			registro.sickLeaveStart || registro.inicioAtestado
		);
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
				if (
					atestadoInicio !== null &&
					atestadoFim !== null &&
					atestadoFim > atestadoInicio
				) {
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
		totalMinutosTrabalhados += trabalhoRegular;
	}

	if (
		totalMinutosTrabalhados === 0 &&
		entrada === null &&
		saida === null &&
		!registro.isSickLeave &&
		!registro.isAtestado
	) {
		return null;
	}

	if (aplicarTolerancia && entrada !== null && saida !== null) {
		totalMinutosTrabalhados = aplicarArredondamento(
			totalMinutosTrabalhados,
			registro
		);
	}

	return totalMinutosTrabalhados;
}

function obterInfoTolerancia(registro) {
	if (
		registro.isHoliday ||
		registro.isFolga ||
		registro.isDayOff ||
		registro.isFeriado
	)
		return null;

	if (
		(registro.isSickLeave || registro.isAtestado) &&
		((!registro.in && !registro.entrada) || (!registro.out && !registro.saida))
	)
		return null;

	const minutosBrutos = calcularMinutosTrabalhados(registro, false);
	const minutosAjustados = calcularMinutosTrabalhados(registro, true);

	if (minutosBrutos === null) return null;

	const minutosContrato =
		hmParaMinutos(estado.configuracoes.horasContrato) || 525;
	const diferenca = minutosBrutos - minutosContrato;
	const toleranciaAplicada = minutosBrutos !== minutosAjustados;

	return {
		bruto: minutosBrutos,
		ajustado: minutosAjustados,
		diferenca: diferenca,
		toleranciaAplicada: toleranciaAplicada,
	};
}

function deveAplicarToleranciaClt(registro, minutosDia) {
	if (!registro || minutosDia === null) return false;
	const minutosContratoDia =
		hmParaMinutos(estado.configuracoes.horasContrato) || 525;
	return Math.abs(minutosDia - minutosContratoDia) <= 10;
}

function aplicarArredondamento(minutos, registro = null) {
	if (minutos === null) return null;
	const arred = estado.configuracoes.arredondamento;
	if (arred === "none") return minutos;
	if (arred === "nearest5") return Math.round(minutos / 5) * 5;
	if (arred === "nearest10") return Math.round(minutos / 10) * 10;
	if (arred === "nearest15") return Math.round(minutos / 15) * 15;
	if (arred === "threshold10") {
		const minutosContratoDia =
			hmParaMinutos(estado.configuracoes.horasContrato) || 525;
		if (deveAplicarToleranciaClt(registro, minutos)) {
			return minutosContratoDia;
		} else {
			return minutos;
		}
	}
	return minutos;
}

function recalcularTotais() {
	const { dataInicio, dataFim } = obterPeriodoCicloTrabalho();

	let soma = 0;
	let dataAtual = new Date(dataInicio);
	const hoje = new Date();
	hoje.setHours(23, 59, 59, 999);
	const limitePeriodo = hoje < dataFim ? hoje : dataFim;
	const diasUteisPassados = obterDiasUteisPassados(dataInicio, limitePeriodo);

	while (dataAtual <= dataFim && dataAtual <= hoje) {
		const iso = dataAtual.toISOString().slice(0, 10);
		const chave = chaveMes(dataAtual);
		const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};
		const escalaTrabalho = estado.configuracoes.escalaTrabalho;
		const deveTrabalhar = deveSerDiaUtil(dataAtual, escalaTrabalho);
		const isFolga = registro.isHoliday || registro.isFolga;
		const isFeriado = registro.isDayOff || registro.isFeriado;

		if ((deveTrabalhar || isFolga) && !isFeriado) {
			const mins = calcularMinutosTrabalhados(registro);
			if (mins !== null) {
				soma += mins;
			}
		}
		dataAtual.setDate(dataAtual.getDate() + 1);
	}

	const hojeCalculo = new Date();
	hojeCalculo.setHours(23, 59, 59, 999);
	const marcoRestante =
		hojeCalculo >= dataInicio
			? hojeCalculo
			: new Date(dataInicio.getTime() - 24 * 60 * 60 * 1000);
	const minutoContratoPorDia =
		hmParaMinutos(estado.configuracoes.horasContrato) || 0;
	totalDiasUteisEl.textContent = diasUteisPassados;
	const diasUteisRestantes = obterDiasUteisRestantes(marcoRestante, dataFim);
	let necessarioDiario = 0;
	const esperado = diasUteisPassados * minutoContratoPorDia;
	const saldo = soma - esperado;

	if (diasUteisRestantes > 0) {
		let folgasCompensarFuturas = 0;
		let dataFutura =
			hojeCalculo >= dataInicio
				? new Date(hojeCalculo)
				: new Date(dataInicio.getTime() - 24 * 60 * 60 * 1000);
		dataFutura.setDate(dataFutura.getDate() + 1);

		while (dataFutura <= dataFim) {
			const iso = dataFutura.toISOString().slice(0, 10);
			const chave = chaveMes(dataFutura);
			const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};

			if (
				(registro.isHoliday || registro.isFolga) &&
				deveSerDiaUtil(dataFutura, estado.configuracoes.escalaTrabalho)
			) {
				folgasCompensarFuturas++;
			}
			dataFutura.setDate(dataFutura.getDate() + 1);
		}

		const horasRestantesRegulares = diasUteisRestantes * minutoContratoPorDia;
		const horasCompensacao = folgasCompensarFuturas * minutoContratoPorDia;
		const totalEsperadoAteAgora = diasUteisPassados * minutoContratoPorDia;
		const saldoAtual = soma - totalEsperadoAteAgora;
		const horasRestantesContrato =
			horasRestantesRegulares + horasCompensacao - saldoAtual;
		necessarioDiario = horasRestantesContrato / diasUteisRestantes;
	}

	totalEsperadoEl.textContent = minutosParaHM(esperado);
	totalTrabalhadoEl.textContent = minutosParaHM(soma);
	saldoEl.textContent = minutosParaHM(saldo);
	necessarioDiarioEl.textContent =
		diasUteisRestantes > 0
			? minutosParaHM(Math.round(necessarioDiario))
			: "0h00";
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

	while (dataAtual <= dataFim) {
		const iso = dataAtual.toISOString().slice(0, 10);
		const chave = chaveMes(dataAtual);
		const registro = (estado.dados[chave] && estado.dados[chave][iso]) || {};

		if (registro.isDayOff || registro.isFeriado) {
			dataAtual.setDate(dataAtual.getDate() + 1);
			continue;
		}

		if (
			((registro.in || registro.entrada) && (registro.out || registro.saida)) ||
			registro.isSickLeave ||
			registro.isAtestado
		) {
			dataAtual.setDate(dataAtual.getDate() + 1);
			continue;
		}

		if (escalaTrabalho === "custom") {
			diasRestantes++;
		} else {
			const deveTrabalhar = deveSerDiaUtil(dataAtual, escalaTrabalho);

			if (deveTrabalhar && !registro.isHoliday && !registro.isFolga) {
				diasRestantes++;
			}
		}

		dataAtual.setDate(dataAtual.getDate() + 1);
	}
	return diasRestantes;
}

document.addEventListener("DOMContentLoaded", () => {
	checkFolga.addEventListener("change", () => {
		if (checkFolga.checked) {
			checkFeriado.checked = false;
		}
		alternarCamposHorario();
	});

	checkFeriado.addEventListener("change", () => {
		if (checkFeriado.checked) {
			checkFolga.checked = false;
		}
		alternarCamposHorario();
	});

	const checkAtestado = document.getElementById("modalIsSickLeave");
	checkAtestado.addEventListener("change", () => {
		alternarCamposHorario();
		alternarCamposAtestado();
	});

	document.getElementById("cancelModal").addEventListener("click", () => {
		modal.classList.remove("show");
	});

	document.getElementById("closeModal").addEventListener("click", () => {
		modal.classList.remove("show");
	});

	document.getElementById("saveDay").addEventListener("click", () => {
		const checkAtestado = document.getElementById("modalIsSickLeave");
		const eAtestado = checkAtestado.checked;
		const inicioAtestado = document.getElementById("modalSickLeaveStart").value;
		const fimAtestado = document.getElementById("modalSickLeaveEnd").value;

		let entrada =
			checkFolga.checked || checkFeriado.checked
				? null
				: horarioEntrada.value || null;
		let saidaAlmoco =
			checkFolga.checked || checkFeriado.checked
				? null
				: horarioSaidaAlmoco.value || null;
		let voltaAlmoco =
			checkFolga.checked || checkFeriado.checked
				? null
				: horarioVoltaAlmoco.value || null;
		let saida =
			checkFolga.checked || checkFeriado.checked
				? null
				: horarioSaida.value || null;

		if (!(checkFolga.checked || checkFeriado.checked)) {
			const entradaPadrao = estado.configuracoes.entradaPadrao || "08:00";
			const saidaAlmocoPadrao =
				estado.configuracoes.saidaAlmocoPadrao || "12:00";
			const voltaAlmocoPadrao =
				estado.configuracoes.voltaAlmocoPadrao || "13:00";
			const saidaPadrao = estado.configuracoes.saidaPadrao || "17:45";
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
			observacao: observacao.value || "",
			isFolga: checkFolga.checked,
			isFeriado: checkFeriado.checked,
			isAtestado: eAtestado,
			inicioAtestado: eAtestado ? inicioAtestado : null,
			fimAtestado: eAtestado ? fimAtestado : null,
		};
		if (!estado.dados[chaveEdicaoAtual]) estado.dados[chaveEdicaoAtual] = {};
		estado.dados[chaveEdicaoAtual][isoEdicaoAtual] = obj;
		modal.classList.remove("show");
		renderizarCalendario();
	});

	document.getElementById("deleteDay").addEventListener("click", () => {
		if (
			estado.dados[chaveEdicaoAtual] &&
			estado.dados[chaveEdicaoAtual][isoEdicaoAtual]
		) {
			delete estado.dados[chaveEdicaoAtual][isoEdicaoAtual];
		}
		modal.classList.remove("show");
		renderizarCalendario();
	});

	document.getElementById("prevMonth").addEventListener("click", () => {
		estado.deslocamentoMes--;
		renderizarCalendario();
	});
	document.getElementById("nextMonth").addEventListener("click", () => {
		estado.deslocamentoMes++;
		renderizarCalendario();
	});

	const selArredondamento = document.getElementById("rounding");
	selArredondamento.addEventListener("change", () => {
		estado.configuracoes.arredondamento = selArredondamento.value;
		recalcularTotais();
		salvarArmazenamento();
	});

	const selEscalaTrabalho = document.getElementById("workSchedule");
	selEscalaTrabalho.addEventListener("change", () => {
		estado.configuracoes.escalaTrabalho = selEscalaTrabalho.value;
		recalcularTotais();
		salvarArmazenamento();
	});

	const inputDiaInicioCiclo = document.getElementById("cycleStartDay");
	inputDiaInicioCiclo.addEventListener("input", () => {
		const valor = parseInt(inputDiaInicioCiclo.value) || 25;
		estado.configuracoes.diaInicioCiclo = Math.max(1, Math.min(31, valor));
		renderizarCalendario();
		salvarArmazenamento();
	});

	const inputEntradaPadrao = document.getElementById("standardEntry");
	const inputSaidaAlmocoPadrao = document.getElementById("standardLunchOut");
	const inputVoltaAlmocoPadrao = document.getElementById("standardLunchIn");
	const inputSaidaPadrao = document.getElementById("standardExit");

	function atualizarHorariosPadrao() {
		estado.configuracoes.entradaPadrao = inputEntradaPadrao.value || "08:00";
		estado.configuracoes.saidaAlmocoPadrao =
			inputSaidaAlmocoPadrao.value || "12:00";
		estado.configuracoes.voltaAlmocoPadrao =
			inputVoltaAlmocoPadrao.value || "13:00";
		estado.configuracoes.saidaPadrao = inputSaidaPadrao.value || "17:45";

		calcularHorasContrato();
		recalcularTotais();
		salvarArmazenamento();
	}

	inputEntradaPadrao.addEventListener("change", atualizarHorariosPadrao);
	inputSaidaAlmocoPadrao.addEventListener("change", atualizarHorariosPadrao);
	inputVoltaAlmocoPadrao.addEventListener("change", atualizarHorariosPadrao);
	inputSaidaPadrao.addEventListener("change", atualizarHorariosPadrao);

	document.getElementById("exportJson").addEventListener("click", () => {
		const dados = { dados: estado.dados, configuracoes: estado.configuracoes };
		const blob = new Blob([JSON.stringify(dados, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `calcHoras_backup_${new Date()
			.toISOString()
			.slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	});

	document
		.getElementById("importJson")
		.addEventListener("click", () =>
			document.getElementById("fileInput").click()
		);

	document.getElementById("fileInput").addEventListener("change", (ev) => {
		const f = ev.target.files[0];
		if (!f) return;
		const leitor = new FileReader();
		leitor.onload = () => {
			try {
				const obj = JSON.parse(leitor.result);
				if (!obj || typeof obj !== "object") {
					throw new Error("O arquivo não contém um objeto JSON válido.");
				}

				let dadosImportados = obj.dados;
				let configImportada = obj.configuracoes;

				if (!dadosImportados && !configImportada) {
					throw new Error(
						"O arquivo não possui dados ou configurações reconhecidos."
					);
				}

				if (dadosImportados) {
					const traduzirRegistro = (reg) => {
						if (!reg) return reg;
						const padrao = estado.configuracoes || {};
						const entradaPadrao = padrao.entradaPadrao || "08:00";
						const saidaAlmocoPadrao = padrao.saidaAlmocoPadrao || "12:00";
						const voltaAlmocoPadrao = padrao.voltaAlmocoPadrao || "13:00";
						const saidaPadrao = padrao.saidaPadrao || "17:45";

						let entrada = reg.entrada ?? reg.in ?? "";
						let saidaAlmoco = reg.saidaAlmoco ?? reg.outLunch ?? "";
						let voltaAlmoco = reg.voltaAlmoco ?? reg.inLunch ?? "";
						let saida = reg.saida ?? reg.out ?? "";

						const algumPreenchido =
							entrada || saidaAlmoco || voltaAlmoco || saida;
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
							observacao: reg.observacao ?? reg.note ?? "",
							isFolga: reg.isFolga ?? reg.isHoliday ?? false,
							isFeriado: reg.isFeriado ?? reg.isDayOff ?? false,
							isAtestado: reg.isAtestado ?? reg.isSickLeave ?? false,
							inicioAtestado: reg.inicioAtestado ?? reg.sickLeaveStart ?? "",
							fimAtestado: reg.fimAtestado ?? reg.sickLeaveEnd ?? "",
						};
					};
					const dadosConvertidos = {};
					for (const chaveMes in dadosImportados) {
						dadosConvertidos[chaveMes] = {};
						for (const dia in dadosImportados[chaveMes]) {
							dadosConvertidos[chaveMes][dia] = traduzirRegistro(
								dadosImportados[chaveMes][dia]
							);
						}
					}
					estado.dados = dadosConvertidos;
				}

				if (configImportada) {
					const c = configImportada;
					estado.configuracoes = {
						horasContrato: c.horasContrato || "8h45",
						arredondamento: c.arredondamento || "threshold10",
						escalaTrabalho: c.escalaTrabalho || "5x2",
						diaInicioCiclo: c.diaInicioCiclo || 25,
						entradaPadrao: c.entradaPadrao || "08:00",
						saidaAlmocoPadrao: c.saidaAlmocoPadrao || "12:00",
						voltaAlmocoPadrao: c.voltaAlmocoPadrao || "13:00",
						saidaPadrao: c.saidaPadrao || "17:45",
					};

					document.getElementById("rounding").value =
						estado.configuracoes.arredondamento;
					document.getElementById("workSchedule").value =
						estado.configuracoes.escalaTrabalho;
					document.getElementById("cycleStartDay").value =
						estado.configuracoes.diaInicioCiclo;

					const entrada = estado.configuracoes.entradaPadrao;
					const saidaAlmoco = estado.configuracoes.saidaAlmocoPadrao;
					const voltaAlmoco = estado.configuracoes.voltaAlmocoPadrao;
					const saida = estado.configuracoes.saidaPadrao;

					document.getElementById("standardEntry").value = entrada.includes("h")
						? entrada.replace("h", ":").padStart(5, "0")
						: entrada;
					document.getElementById("standardLunchOut").value =
						saidaAlmoco.includes("h")
							? saidaAlmoco.replace("h", ":").padStart(5, "0")
							: saidaAlmoco;
					document.getElementById("standardLunchIn").value =
						voltaAlmoco.includes("h")
							? voltaAlmoco.replace("h", ":").padStart(5, "0")
							: voltaAlmoco;
					document.getElementById("standardExit").value = saida.includes("h")
						? saida.replace("h", ":").padStart(5, "0")
						: saida;

					estado.configuracoes.entradaPadrao =
						document.getElementById("standardEntry").value;
					estado.configuracoes.saidaAlmocoPadrao =
						document.getElementById("standardLunchOut").value;
					estado.configuracoes.voltaAlmocoPadrao =
						document.getElementById("standardLunchIn").value;
					estado.configuracoes.saidaPadrao =
						document.getElementById("standardExit").value;

					calcularHorasContrato();
				}

				salvarArmazenamento();
				renderizarCalendario();
				alert("Dados importados com sucesso!");
			} catch (e) {
				alert(
					`Erro ao importar arquivo: ${e.message}\n\nO arquivo deve ter as propriedades "dados" e/ou "configuracoes".`
				);
			}
		};
		leitor.readAsText(f);
	});

	document.getElementById("clearData").addEventListener("click", () => {
		if (confirm("Apagar todos os dados locais?")) {
			localStorage.removeItem(CHAVE_ARMAZENAMENTO);
			estado.dados = {};
			renderizarCalendario();
		}
	});

	carregarArmazenamento();

	if (typeof estado.configuracoes.horasContrato === "number") {
		const horas = Math.floor(estado.configuracoes.horasContrato);
		const minutos = Math.round(
			(estado.configuracoes.horasContrato - horas) * 60
		);
		estado.configuracoes.horasContrato =
			formatarNumero(horas) + ":" + formatarNumero(minutos);
	}

	document.getElementById("rounding").value =
		estado.configuracoes.arredondamento;
	document.getElementById("workSchedule").value =
		estado.configuracoes.escalaTrabalho;
	document.getElementById("cycleStartDay").value =
		estado.configuracoes.diaInicioCiclo;

	document.getElementById("standardEntry").value =
		estado.configuracoes.entradaPadrao;
	document.getElementById("standardLunchOut").value =
		estado.configuracoes.saidaAlmocoPadrao;
	document.getElementById("standardLunchIn").value =
		estado.configuracoes.voltaAlmocoPadrao;
	document.getElementById("standardExit").value =
		estado.configuracoes.saidaPadrao;

	calcularHorasContrato();
	renderizarCalendario();

	const toggleSidebar = document.getElementById("toggleSidebar");
	const sidebar = document.querySelector(".sidebar");
	const sidebarOverlay = document.getElementById("sidebarOverlay");

	toggleSidebar.addEventListener("click", () => {
		sidebar.classList.add("show");
		sidebarOverlay.classList.add("show");
	});

	document.addEventListener("click", (e) => {
		if (
			sidebar.classList.contains("show") &&
			!sidebar.contains(e.target) &&
			!toggleSidebar.contains(e.target)
		) {
			sidebar.classList.remove("show");
			sidebarOverlay.classList.remove("show");
		}
	});
});
