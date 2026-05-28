import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "./supabaseClient";

const STORAGE_BUCKET = "anexos-indicadores";

const usuarios = [
  { nome: "Almoxarifado U&C", senha: "UC1", setor: "Almoxarifado (Uso & Consumo)" },
  { nome: "Recebimento e Armazenagem", senha: "RA2", setor: "Operações Recebimento Geral" },
  { nome: "Estoque e Inventário", senha: "EI3", setor: "Estoque" },
  { nome: "Operação Secos", senha: "OS4", setor: "Operações Secos" },
  { nome: "Operações Química", senha: "OQ5", setor: "Operações Químicas" },
  { nome: "Gestão", senha: "GE6", setor: "Todos" },
];

const indicadoresBase = [
  { id: 1, setor: "Operações Químicas", indicador: "Perda MP no Processo", meta: 3, unidade: "%", regraMeta: "menor", tipoCalculo: "r1r2", r1Nome: "Inventário perda em R$ / dia", r2Nome: "Total estoque químico em R$", descricao: "Resultado = R1 / R2 em porcentagem" },
  { id: 2, setor: "Operações Químicas", indicador: "Conformidade Peso na Separação - Erros na 1º Pesagem", meta: 5, unidade: "%", regraMeta: "menor", tipoCalculo: "r1r2", r1Nome: "Qtd de pesagem real em Kg", r2Nome: "Qtd de pesagem solicitada na OP em Kg", descricao: "Resultado = R1 / R2 em porcentagem" },
  { id: 3, setor: "Operações Secos", indicador: "Avarias / Perda Embalagens no Processo", meta: 1, unidade: "%", regraMeta: "menor", tipoCalculo: "r1r2", r1Nome: "Inventário perda em R$ / dia", r2Nome: "Total estoque seco em R$", descricao: "Resultado = R1 / R2 em porcentagem" },
  { id: 4, setor: "Operações Secos", indicador: "Erros de Movimentação DMP", meta: 2, unidade: "%", regraMeta: "menor", tipoCalculo: "r1r2", r1Nome: "Itens movimentados errado", r2Nome: "Total de itens movimentados no turno", descricao: "Resultado = R1 / R2 em porcentagem" },
  { id: 5, setor: "Estoque", indicador: "Acuracidade de Estoque", meta: 98, unidade: "%", regraMeta: "maior", tipoCalculo: "r1r2", r1Nome: "Total de itens corretos", r2Nome: "Total de itens inventariados", descricao: "Resultado = R1 / R2 em porcentagem" },
  { id: 6, setor: "Estoque", indicador: "Ruptura de Produto Acabado causada pelo setor DMP", meta: 2, unidade: "%", regraMeta: "menor", tipoCalculo: "percentualDireto", r1Nome: "Percentual de ruptura do dia", r2Nome: "Não aplicável", descricao: "Resultado = R1 informado em porcentagem" },
  { id: 7, setor: "Operações Recebimento Geral", indicador: "Avarias no Recebimento", meta: 1, unidade: "%", regraMeta: "menor", tipoCalculo: "r1r2", r1Nome: "Recebimento perda em R$ / dia", r2Nome: "Quantidade total recebido no dia em R$", descricao: "Resultado = R1 / R2 em porcentagem" },
  { id: 8, setor: "Operações Recebimento Geral", indicador: "TMR - Tempo Médio de Recebimento", meta: 60, unidade: "min", regraMeta: "menor", tipoCalculo: "mediaTempoMinutos", r1Nome: "Tempo total de recebimento em minutos", r2Nome: "Total de carros/cargas no dia", descricao: "Resultado = tempo total / total de carros ou cargas" },
  { id: 9, setor: "Almoxarifado (Uso & Consumo)", indicador: "Acuracidade de Estoque Almoxarifado U&C", meta: 98, unidade: "%", regraMeta: "maior", tipoCalculo: "r1r2", r1Nome: "Total de itens corretos", r2Nome: "Total de itens inventariados", descricao: "Resultado = R1 / R2 em porcentagem" },
  { id: 10, setor: "Almoxarifado (Uso & Consumo)", indicador: "Ruptura de Produto Acabado causada pelo Almoxarifado U&C", meta: 2, unidade: "%", regraMeta: "menor", tipoCalculo: "percentualDireto", r1Nome: "Percentual de ruptura do dia", r2Nome: "Não aplicável", descricao: "Resultado = R1 informado em porcentagem" },
];

const registrosIniciais = [];

function calcularResultado(registros, indicador) {
  if (indicador.tipoCalculo === "percentualDireto") {
    if (!registros.length) return 0;
    return registros.reduce((acc, item) => acc + Number(item.r1 || 0), 0) / registros.length;
  }

  if (indicador.tipoCalculo === "mediaTempoMinutos") {
    const somaMinutos = registros.reduce((acc, item) => acc + Number(item.r1 || 0), 0);
    const somaCargas = registros.reduce((acc, item) => acc + Number(item.r2 || 0), 0);
    return somaCargas ? somaMinutos / somaCargas : 0;
  }

  const somaR1 = registros.reduce((acc, item) => acc + Number(item.r1 || 0), 0);
  const somaR2 = registros.reduce((acc, item) => acc + Number(item.r2 || 0), 0);
  return somaR2 ? (somaR1 / somaR2) * 100 : 0;
}

function formatarTempoHHMM(minutos) {
  const totalMinutos = Math.round(Number(minutos || 0));
  const horas = Math.floor(totalMinutos / 60);
  const mins = totalMinutos % 60;
  return `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function statusIndicador(resultado, indicador) {
  const dentroDaMeta = indicador.regraMeta === "menor"
    ? resultado <= indicador.meta
    : resultado >= indicador.meta;

  if (dentroDaMeta) {
    return {
      texto: "Dentro da Meta",
      classe: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
      painel: "bg-emerald-500/15 text-emerald-100 border border-emerald-400/30 shadow-[0_0_22px_rgba(52,211,153,0.22)]",
      borda: "border-emerald-400/35",
    };
  }

  return {
    texto: "Fora da Meta",
    classe: "border-red-400/40 bg-red-500/10 text-red-300",
    painel: "bg-red-500/15 text-red-100 border border-red-400/30 shadow-[0_0_22px_rgba(248,113,113,0.22)]",
    borda: "border-red-400/35",
  };
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-[1.65rem] border bg-slate-950/55 p-5 shadow-[0_0_32px_rgba(0,80,255,0.13)] backdrop-blur-xl ${className || "border-slate-700/45"}`}>
      {children}
    </div>
  );
}

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

function valorFormatado(valor, indicador) {
  return indicador.tipoCalculo === "mediaTempoMinutos"
    ? formatarTempoHHMM(valor)
    : `${Number(valor || 0).toFixed(2)}${indicador.unidade}`;
}

function formatarDataISO(data) {
  return data.toISOString().slice(0, 10);
}

function registroDentroPeriodo(registro, inicio, fim) {
  return registro.data >= inicio && registro.data <= fim;
}

export default function AppIndicadoresArea() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [login, setLogin] = useState({ nome: "", senha: "" });
  const [erroLogin, setErroLogin] = useState("");
  const [aba, setAba] = useState("dashboard");

  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [tipoVisao, setTipoVisao] = useState("diario");
  const [semanaFiltro, setSemanaFiltro] = useState("1");
  const [diaCalendarioFiltro, setDiaCalendarioFiltro] = useState(formatarDataISO(new Date()));

  const [setorFiltro, setSetorFiltro] = useState("Todos");
  const [registros, setRegistros] = useState(registrosIniciais);
  const [carregandoBanco, setCarregandoBanco] = useState(false);
  const [erroBanco, setErroBanco] = useState("");
  const [salvandoRegistro, setSalvandoRegistro] = useState(false);

  const [novo, setNovo] = useState({
    data: formatarDataISO(new Date()),
    indicadorId: 1,
    turno: "",
    r1: "",
    r2: "",
    anexos: [],
  });

  useEffect(() => {
    carregarRegistrosBanco();
  }, []);

  async function carregarRegistrosBanco() {
    setCarregandoBanco(true);
    setErroBanco("");

    const { data, error } = await supabase
      .from("registros_indicadores")
      .select("*, anexos_indicadores(*)")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErroBanco("Não foi possível carregar os registros do banco de dados.");
      setCarregandoBanco(false);
      return;
    }

    const registrosConvertidos = (data || []).map((item) => ({
      id: item.id,
      data: item.data,
      indicadorId: Number(item.indicador_id),
      turno: item.turno,
      r1: Number(item.r1 || 0),
      r2: Number(item.r2 || 0),
      anexos: (item.anexos_indicadores || []).map((anexo) => ({
        nome: anexo.nome_arquivo,
        tipo: anexo.tipo_arquivo,
        url: anexo.url_arquivo,
      })),
    }));

    setRegistros(registrosConvertidos);
    setCarregandoBanco(false);
  }

  const setoresDisponiveis = useMemo(
    () => ["Todos", ...Array.from(new Set(indicadoresBase.map((i) => i.setor)))],
    []
  );

  const periodoSelecionado = useMemo(() => {
    const nomesMeses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    if (tipoVisao === "diario") {
      const dataSelecionada = new Date(`${diaCalendarioFiltro}T00:00:00`);
      return {
        inicio: diaCalendarioFiltro,
        fim: diaCalendarioFiltro,
        label: `Visão diária — ${dataSelecionada.toLocaleDateString("pt-BR")}`,
      };
    }

    const inicioMes = new Date(anoFiltro, mesFiltro - 1, 1);
    const fimMes = new Date(anoFiltro, mesFiltro, 0);

    if (tipoVisao === "mensal") {
      return {
        inicio: formatarDataISO(inicioMes),
        fim: formatarDataISO(fimMes),
        label: `Visão mensal — ${nomesMeses[mesFiltro - 1]} de ${anoFiltro}`,
      };
    }

    const numeroSemana = Number(semanaFiltro);
    const diaInicio = 1 + (numeroSemana - 1) * 7;
    const diaFim = Math.min(diaInicio + 6, fimMes.getDate());

    const inicioSemana = new Date(anoFiltro, mesFiltro - 1, diaInicio);
    const fimSemana = new Date(anoFiltro, mesFiltro - 1, diaFim);

    return {
      inicio: formatarDataISO(inicioSemana),
      fim: formatarDataISO(fimSemana),
      label: `Visão semanal — ${numeroSemana}ª semana de ${nomesMeses[mesFiltro - 1]} de ${anoFiltro}`,
    };
  }, [tipoVisao, anoFiltro, mesFiltro, semanaFiltro, diaCalendarioFiltro]);

  const resumoIndicadores = useMemo(() => {
    return indicadoresBase
      .filter((indicador) => setorFiltro === "Todos" || indicador.setor === setorFiltro)
      .map((indicador) => {
        const regs = registros.filter(
          (r) =>
            r.indicadorId === indicador.id &&
            registroDentroPeriodo(r, periodoSelecionado.inicio, periodoSelecionado.fim)
        );

        const resultado = calcularResultado(regs, indicador);
        const somaR1 = regs.reduce((acc, item) => acc + Number(item.r1 || 0), 0);
        const somaR2 = regs.reduce((acc, item) => acc + Number(item.r2 || 0), 0);

        return {
          ...indicador,
          resultado,
          status: statusIndicador(resultado, indicador),
          registros: regs,
          somaR1,
          somaR2,
        };
      });
  }, [registros, periodoSelecionado, setorFiltro]);

  const verdes = resumoIndicadores.filter((i) => i.status.texto === "Dentro da Meta").length;
  const vermelhos = resumoIndicadores.filter((i) => i.status.texto === "Fora da Meta").length;

  function gerarCurvaIndicador(indicador) {
    const base = new Date(`${diaCalendarioFiltro}T00:00:00`);
    const dias = [];

    for (let i = 4; i >= 0; i--) {
      const data = new Date(base);
      data.setDate(base.getDate() - i);
      const dataISO = formatarDataISO(data);
      const diaMes = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const regsDia = registros.filter((r) => r.indicadorId === indicador.id && r.data === dataISO);

      dias.push({
        data: diaMes,
        resultado: Number(calcularResultado(regsDia, indicador).toFixed(2)),
        meta: indicador.meta,
      });
    }

    return dias;
  }

  function entrar() {
    const usuario = usuarios.find((u) => u.nome === login.nome && u.senha === login.senha);

    if (!usuario) {
      setErroLogin("Usuário ou senha inválidos.");
      return;
    }

    setUsuarioLogado(usuario);
    setSetorFiltro(usuario.setor);

    const primeiroIndicador = indicadoresBase.find(
      (i) => usuario.setor === "Todos" || i.setor === usuario.setor
    );

    if (primeiroIndicador) {
      setNovo((atual) => ({
        ...atual,
        indicadorId: primeiroIndicador.id,
        turno: "",
      }));
    }

    setErroLogin("");
  }

  function sair() {
    setUsuarioLogado(null);
    setLogin({ nome: "", senha: "" });
    setSetorFiltro("Todos");
  }

  function obterTurnosPorSetor() {
    const indicadorSelecionado = indicadoresBase.find((i) => i.id === Number(novo.indicadorId));
    const setor = indicadorSelecionado?.setor || "";

    if (
      setor === "Operações Químicas" ||
      setor === "Operações Secos" ||
      setor === "Almoxarifado (Uso & Consumo)"
    ) {
      return ["Turno A", "Turno B", "Turno C", "Turno D"];
    }

    return ["Comercial"];
  }

  async function adicionarRegistro() {
    const indicadorSelecionado = indicadoresBase.find((i) => i.id === Number(novo.indicadorId));

    if (!indicadorSelecionado || !novo.data || !novo.turno || !novo.r1) {
      setErroBanco("Preencha data, indicador, turno e R1 antes de adicionar.");
      return;
    }

    if (indicadorSelecionado.tipoCalculo !== "percentualDireto" && !novo.r2) {
      setErroBanco("Preencha o R2 antes de adicionar.");
      return;
    }

    setSalvandoRegistro(true);
    setErroBanco("");

    const registroParaCalculo = {
      id: Date.now(),
      data: novo.data,
      indicadorId: Number(novo.indicadorId),
      turno: novo.turno,
      r1: Number(novo.r1),
      r2: indicadorSelecionado.tipoCalculo === "percentualDireto" ? 0 : Number(novo.r2),
      anexos: [],
    };

    const resultadoCalculado = calcularResultado([registroParaCalculo], indicadorSelecionado);

    const { data: registroCriado, error } = await supabase
      .from("registros_indicadores")
      .insert({
        data: novo.data,
        indicador_id: Number(novo.indicadorId),
        indicador_nome: indicadorSelecionado.indicador,
        setor: indicadorSelecionado.setor,
        turno: novo.turno,
        r1: Number(novo.r1),
        r2: indicadorSelecionado.tipoCalculo === "percentualDireto" ? 0 : Number(novo.r2),
        resultado: resultadoCalculado,
        unidade: indicadorSelecionado.unidade,
        usuario_nome: usuarioLogado?.nome || "",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setErroBanco("Erro ao salvar registro no banco de dados.");
      setSalvandoRegistro(false);
      return;
    }

    const anexosSalvos = [];
    const errosAnexos = [];

    for (const anexo of novo.anexos || []) {
      if (!anexo?.file) continue;

      const nomeSeguro = String(anexo.nome || anexo.file.name || "arquivo")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const caminhoArquivo = `${registroCriado.id}/${Date.now()}-${nomeSeguro}`;

      const { error: erroUpload } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(caminhoArquivo, anexo.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: anexo.file.type || anexo.tipo || "application/octet-stream",
        });

      if (erroUpload) {
        console.error("Erro no upload do anexo:", erroUpload);
        errosAnexos.push(`${anexo.nome}: ${erroUpload.message || "falha no upload"}`);
        continue;
      }

      const { data: urlPublica } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(caminhoArquivo);

      if (!urlPublica?.publicUrl) {
        errosAnexos.push(`${anexo.nome}: URL pública não gerada`);
        continue;
      }

      const { data: anexoCriado, error: erroAnexo } = await supabase
        .from("anexos_indicadores")
        .insert({
          registro_id: registroCriado.id,
          nome_arquivo: anexo.nome,
          tipo_arquivo: anexo.tipo || anexo.file.type || "documento",
          url_arquivo: urlPublica.publicUrl,
        })
        .select()
        .single();

      if (erroAnexo) {
        console.error("Erro ao gravar anexo na tabela:", erroAnexo);
        errosAnexos.push(`${anexo.nome}: ${erroAnexo.message || "falha ao gravar na tabela"}`);
        continue;
      }

      if (anexoCriado) {
        anexosSalvos.push({
          nome: anexoCriado.nome_arquivo,
          tipo: anexoCriado.tipo_arquivo,
          url: anexoCriado.url_arquivo,
        });
      }
    }

    if (errosAnexos.length > 0) {
      setErroBanco(
        `Registro salvo, mas houve erro em anexo(s): ${errosAnexos.join(" | ")}`
      );
    }

    setRegistros([
      ...registros,
      {
        id: registroCriado.id,
        data: registroCriado.data,
        indicadorId: Number(registroCriado.indicador_id),
        turno: registroCriado.turno,
        r1: Number(registroCriado.r1),
        r2: Number(registroCriado.r2 || 0),
        anexos: anexosSalvos,
      },
    ]);

    setDiaCalendarioFiltro(novo.data);
    setNovo({ ...novo, r1: "", r2: "", anexos: [] });
    setSalvandoRegistro(false);
  }

  async function removerRegistro(id) {
    setErroBanco("");

    const { error } = await supabase
      .from("registros_indicadores")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setErroBanco("Erro ao excluir registro do banco de dados.");
      return;
    }

    setRegistros(registros.filter((r) => r.id !== id));
  }

  if (!usuarioLogado) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030711] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(0,102,255,0.18),transparent_28%),radial-gradient(circle_at_92%_88%,rgba(0,132,255,0.16),transparent_30%),linear-gradient(135deg,#02040a_0%,#07111f_42%,#02040a_100%)]" />

      <div className="absolute -left-24 top-0 h-[520px] w-[170px] rotate-[31deg] border-r border-blue-500/20 bg-gradient-to-r from-transparent via-blue-950/30 to-blue-500/10" />
      <div className="absolute right-[-90px] bottom-[-120px] h-[520px] w-[160px] rotate-[31deg] border-l border-blue-500/20 bg-gradient-to-l from-transparent via-blue-950/30 to-blue-500/10" />

      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-6">
        <section className="w-full text-center">
          <h1 className="text-5xl font-black uppercase leading-none tracking-[0.06em] text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)] md:text-6xl">
            VONIXX
          </h1>

          <div className="mx-auto mt-3 h-px w-64 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_18px_rgba(59,130,246,0.9)]" />

          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Gestão Integrada
          </h2>

          <p className="mt-3 text-base font-medium text-slate-300">
            Acesse o painel operacional do seu setor.
          </p>
        </section>

        <section className="mt-7 w-full max-w-xl rounded-[1.5rem] border border-slate-400/20 bg-[#050b16]/70 p-6 shadow-[0_0_38px_rgba(0,68,180,0.22)] backdrop-blur-xl">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-black uppercase tracking-[0.16em] text-blue-400">
                Usuário
              </label>

              <select
                value={login.nome}
                onChange={(e) => setLogin({ ...login, nome: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-500/40 bg-[#020711]/75 px-4 py-4 text-base font-medium text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
              >
                <option value="" className="bg-slate-950">
                  Selecione o usuário
                </option>
                {usuarios.map((u) => (
                  <option key={u.nome} value={u.nome} className="bg-slate-950">
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-black uppercase tracking-[0.16em] text-blue-400">
                Senha
              </label>

              <input
                type="password"
                value={login.senha}
                onChange={(e) => setLogin({ ...login, senha: e.target.value })}
                placeholder="Digite a senha"
                className="mt-2 w-full rounded-xl border border-slate-500/40 bg-[#020711]/75 px-4 py-4 text-base font-medium text-white outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20"
              />
            </div>

            {erroLogin && (
              <p className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm font-bold text-red-200">
                {erroLogin}
              </p>
            )}

            <button
              onClick={entrar}
              className="w-full rounded-xl border border-cyan-300/60 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 px-5 py-4 text-base font-black uppercase tracking-[0.08em] text-white shadow-[0_0_28px_rgba(37,99,235,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_0_38px_rgba(37,99,235,0.7)]"
            >
              Entrar no Painel
            </button>
          </div>
        </section>

        <footer className="mt-5 text-sm font-medium text-slate-400">
          Aplicativo de Indicadores Operacionais
        </footer>
      </main>
    </div>
  );
}

  const indicadoresParaEntrada = indicadoresBase.filter(
    (ind) => usuarioLogado.setor === "Todos" || ind.setor === usuarioLogado.setor
  );

  const indicadorEntrada =
    indicadoresBase.find((i) => i.id === Number(novo.indicadorId)) || indicadoresParaEntrada[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030711] p-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(0,102,255,0.20),transparent_28%),radial-gradient(circle_at_88%_86%,rgba(0,132,255,0.18),transparent_30%),linear-gradient(135deg,#02040a_0%,#07111f_45%,#02040a_100%)]" />
      <div className="absolute -left-32 top-0 h-[620px] w-[210px] rotate-[31deg] border-r border-blue-500/25 bg-gradient-to-r from-transparent via-blue-950/40 to-blue-500/10" />
      <div className="absolute right-[-120px] bottom-[-160px] h-[640px] w-[210px] rotate-[31deg] border-l border-blue-500/30 bg-gradient-to-l from-transparent via-blue-950/35 to-blue-500/10" />
      <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle,#60a5fa_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-700/40 bg-slate-950/55 p-5 text-white shadow-[0_0_45px_rgba(0,80,255,0.18)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-blue-300">
                Gestão Integrada de Operações & Materiais
              </p>
              <h1 className="mt-2 text-3xl font-black">
                Aplicativo de Indicadores Operacionais
              </h1>
              <p className="mt-2 text-slate-400">
                Controle diário por setor, data, turnos, cálculo automático e semáforo executivo.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700/40 bg-[#07111f]/80 p-4 text-sm shadow-lg">
              <p className="text-slate-300">Usuário logado</p>
              <p className="font-bold">{usuarioLogado.nome}</p>
              <p className="text-slate-300">Setor: {usuarioLogado.setor}</p>
              <button
                onClick={sair}
                className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 font-black text-red-300"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <nav className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-slate-700/40 bg-slate-950/50 p-2 shadow-[0_0_24px_rgba(0,80,255,0.10)] backdrop-blur">
          {[
            ["dashboard", "Dashboard Executivo"],
            ["entrada", "Entrada Manual"],
            ["tv", "Modo TV"],
          ].map(([valor, texto]) => (
            <button
              key={valor}
              onClick={() => setAba(valor)}
              className={`rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-[0.08em] transition ${
                aba === valor ? "bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white shadow-[0_0_24px_rgba(37,99,235,0.45)]" : "bg-[#07111f]/70 text-slate-300 hover:bg-blue-950/60"
              }`}
            >
              {texto}
            </button>
          ))}
        </nav>

        {aba === "dashboard" && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Setor:</span>
              <select
                value={setorFiltro}
                onChange={(e) => setSetorFiltro(e.target.value)}
                disabled={usuarioLogado.setor !== "Todos"}
                className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-sm font-semibold text-white outline-none disabled:opacity-60"
              >
                {setoresDisponiveis.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              <span className="text-sm font-medium">Visão:</span>
              <select
                value={tipoVisao}
                onChange={(e) => setTipoVisao(e.target.value)}
                className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-sm font-semibold text-white outline-none"
              >
                <option value="diario">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>

              {tipoVisao === "diario" && (
                <>
                  <span className="text-sm font-medium">Dia:</span>
                  <input
                    type="date"
                    value={diaCalendarioFiltro}
                    onChange={(e) => {
                      setDiaCalendarioFiltro(e.target.value);
                      const data = new Date(`${e.target.value}T00:00:00`);
                      setAnoFiltro(data.getFullYear());
                      setMesFiltro(data.getMonth() + 1);
                    }}
                    className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-sm font-semibold text-white outline-none"
                  />
                </>
              )}

              {(tipoVisao === "semanal" || tipoVisao === "mensal") && (
                <>
                  <span className="text-sm font-medium">Ano:</span>
                  <select
                    value={anoFiltro}
                    onChange={(e) => setAnoFiltro(Number(e.target.value))}
                    className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-sm font-semibold text-white outline-none"
                  >
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                    <option value={2028}>2028</option>
                  </select>

                  <span className="text-sm font-medium">Mês:</span>
                  <select
                    value={mesFiltro}
                    onChange={(e) => setMesFiltro(Number(e.target.value))}
                    className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-sm font-semibold text-white outline-none"
                  >
                    <option value={1}>Janeiro</option>
                    <option value={2}>Fevereiro</option>
                    <option value={3}>Março</option>
                    <option value={4}>Abril</option>
                    <option value={5}>Maio</option>
                    <option value={6}>Junho</option>
                    <option value={7}>Julho</option>
                    <option value={8}>Agosto</option>
                    <option value={9}>Setembro</option>
                    <option value={10}>Outubro</option>
                    <option value={11}>Novembro</option>
                    <option value={12}>Dezembro</option>
                  </select>
                </>
              )}

              {tipoVisao === "semanal" && (
                <>
                  <span className="text-sm font-medium">Semana:</span>
                  <select
                    value={semanaFiltro}
                    onChange={(e) => setSemanaFiltro(e.target.value)}
                    className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-sm font-semibold text-white outline-none"
                  >
                    <option value="1">1ª semana</option>
                    <option value="2">2ª semana</option>
                    <option value="3">3ª semana</option>
                    <option value="4">4ª semana</option>
                    <option value="5">5ª semana</option>
                  </select>
                </>
              )}

              <Badge className="border-blue-400/40 bg-blue-500/10 text-blue-200">
                {periodoSelecionado.label}
              </Badge>
            </div>

            {erroBanco && (
              <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-300">
                {erroBanco}
              </div>
            )}

            {carregandoBanco && (
              <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-cyan-300">
                Carregando dados do banco de dados...
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <p className="text-sm text-slate-400">Setor</p>
                <h2 className="text-xl font-bold">{setorFiltro}</h2>
              </Card>

              <Card>
                <p className="text-sm text-slate-400">Indicadores</p>
                <h2 className="text-3xl font-bold">{resumoIndicadores.length}</h2>
              </Card>

              <Card>
                <p className="text-sm text-slate-400">Dentro da Meta</p>
                <h2 className="text-3xl font-bold text-emerald-300">{verdes}</h2>
              </Card>

              <Card>
                <p className="text-sm text-slate-400">Fora da Meta</p>
                <h2 className="text-3xl font-bold text-red-300">{vermelhos}</h2>
              </Card>

              <Card>
                <p className="text-sm text-slate-400">Registros do Período</p>
                <h2 className="text-3xl font-bold">
                  {resumoIndicadores.reduce((acc, i) => acc + i.registros.length, 0)}
                </h2>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {resumoIndicadores.map((item) => (
                <Card key={item.id} className={item.status.borda}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">{item.setor}</p>
                      <h3 className="text-xl font-bold">{item.indicador}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Meta: {item.regraMeta === "menor" ? "até" : "mínimo"} {item.meta}
                        {item.unidade} | {item.descricao}
                      </p>
                    </div>

                    <Badge className={item.status.classe}>{item.status.texto}</Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-700/40 bg-[#07111f]/90 p-4">
                      <p className="text-xs text-slate-400">R1 Total</p>
                      <h4 className="text-xl font-bold">{item.somaR1.toLocaleString("pt-BR")}</h4>
                    </div>

                    <div className="rounded-2xl border border-slate-700/40 bg-[#07111f]/90 p-4">
                      <p className="text-xs text-slate-400">R2 Total</p>
                      <h4 className="text-xl font-bold">
                        {item.tipoCalculo === "percentualDireto"
                          ? "N/A"
                          : item.somaR2.toLocaleString("pt-BR")}
                      </h4>
                    </div>

                    <div className={`rounded-2xl p-4 ${item.status.painel}`}>
                      <p className="text-xs opacity-80">Resultado</p>
                      <h4 className="text-2xl font-bold">{valorFormatado(item.resultado, item)}</h4>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold">Curva de Resultado - Últimos 5 Dias</h3>
                <p className="text-sm text-slate-400">
                  Visualização individual por setor e indicador.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {resumoIndicadores.map((indicador) => {
                  const dadosCurva = gerarCurvaIndicador(indicador);

                  return (
                    <Card key={indicador.id} className={indicador.status.borda}>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-400">{indicador.setor}</p>
                          <h4 className="text-lg font-bold">{indicador.indicador}</h4>
                          <p className="text-sm text-slate-400">
                            Meta: {indicador.regraMeta === "menor" ? "até" : "mínimo"}{" "}
                            {indicador.meta}
                            {indicador.unidade}
                          </p>
                        </div>

                        <Badge className={indicador.status.classe}>
                          {indicador.status.texto}
                        </Badge>
                      </div>

                      <div className={`mb-3 rounded-2xl p-4 text-center font-bold ${indicador.status.painel}`}>
                        Resultado atual: {valorFormatado(indicador.resultado, indicador)}
                      </div>

                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dadosCurva}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="data" />
                            <YAxis />
                            <Tooltip
                              formatter={(value, name) =>
                                indicador.tipoCalculo === "mediaTempoMinutos"
                                  ? [formatarTempoHHMM(value), name]
                                  : [`${Number(value).toFixed(2)}${indicador.unidade}`, name]
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="meta"
                              name="Meta"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="resultado"
                              name="Resultado"
                              strokeWidth={3}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {aba === "entrada" && (
          <section className="space-y-6">
            {erroBanco && (
              <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-300">
                {erroBanco}
              </div>
            )}

            <Card>
              <h3 className="mb-4 text-xl font-bold">Preenchimento diário por turno</h3>

              <div className="grid gap-3 md:grid-cols-5">
                <input
                  type="date"
                  value={novo.data}
                  onChange={(e) => setNovo({ ...novo, data: e.target.value })}
                  className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                />

                <select
                  value={novo.indicadorId}
                  onChange={(e) =>
                    setNovo({
                      ...novo,
                      indicadorId: Number(e.target.value),
                      r1: "",
                      r2: "",
                      turno: "",
                    })
                  }
                  className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-white outline-none md:col-span-2"
                >
                  {indicadoresParaEntrada.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {ind.setor} | {ind.indicador}
                    </option>
                  ))}
                </select>

                <select
                  value={novo.turno}
                  onChange={(e) => setNovo({ ...novo, turno: e.target.value })}
                  className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                >
                  <option value="">Selecione o turno</option>
                  {obterTurnosPorSetor().map((turno) => (
                    <option key={turno} value={turno}>
                      {turno}
                    </option>
                  ))}
                </select>

                <button
                  onClick={adicionarRegistro}
                  disabled={salvandoRegistro}
                  className="rounded-xl border border-cyan-300/60 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 px-5 py-3 font-black uppercase tracking-[0.08em] text-white shadow-[0_0_24px_rgba(37,99,235,0.38)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvandoRegistro ? "Salvando..." : "Adicionar"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  placeholder={indicadorEntrada?.r1Nome || "R1"}
                  type="number"
                  value={novo.r1}
                  onChange={(e) => setNovo({ ...novo, r1: e.target.value })}
                  className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                />

                {indicadorEntrada?.tipoCalculo !== "percentualDireto" && (
                  <input
                    placeholder={indicadorEntrada?.r2Nome || "R2"}
                    type="number"
                    value={novo.r2}
                    onChange={(e) => setNovo({ ...novo, r2: e.target.value })}
                    className="rounded-xl border border-slate-600/50 bg-[#020711]/75 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-blue-400/30 bg-blue-500/5 p-4">
                <label className="text-sm font-bold text-slate-200">
                  Anexar fotos ou documentos
                </label>

                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={(e) => {
                    const arquivos = Array.from(e.target.files || []).map((file) => ({
                      nome: file.name,
                      tipo: file.type || "documento",
                      tamanho: file.size,
                      url: URL.createObjectURL(file),
                      file,
                    }));

                    setNovo({ ...novo, anexos: arquivos });
                  }}
                  className="mt-2 block w-full rounded-xl border border-slate-600/50 bg-[#020711]/75 px-3 py-3 text-sm text-white"
                />

                {novo.anexos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {novo.anexos.map((arquivo, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-[#07111f]/80 px-3 py-2 text-sm shadow-sm"
                      >
                        <span className="font-medium text-slate-200">{arquivo.nome}</span>
                        <a
                          href={arquivo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-cyan-300"
                        >
                          Visualizar
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </Card>

            <Card>
              <h3 className="mb-4 text-xl font-bold">Registros lançados</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-blue-950/40 text-left text-xs uppercase tracking-[0.12em] text-blue-200">
                    <tr>
                      <th className="p-3">Data</th>
                      <th>Indicador</th>
                      <th>Turno</th>
                      <th>R1</th>
                      <th>R2</th>
                      <th>Resultado</th>
                      <th>Anexos</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {registros
                      .filter((r) => {
                        const ind = indicadoresBase.find((i) => i.id === r.indicadorId);
                        return usuarioLogado.setor === "Todos" || ind?.setor === usuarioLogado.setor;
                      })
                      .map((r) => {
                        const indicador = indicadoresBase.find((i) => i.id === r.indicadorId);
                        const resultado = indicador ? calcularResultado([r], indicador) : 0;
                        const st = indicador
                          ? statusIndicador(resultado, indicador)
                          : { painel: "bg-slate-500 text-white" };

                        return (
                          <tr key={r.id} className="border-t border-slate-800/80 text-slate-300">
                            <td className="p-3 font-bold text-white">{r.data}</td>
                            <td>{indicador?.indicador}</td>
                            <td>{r.turno}</td>
                            <td>{Number(r.r1).toLocaleString("pt-BR")}</td>
                            <td>
                              {indicador?.tipoCalculo === "percentualDireto"
                                ? "N/A"
                                : Number(r.r2).toLocaleString("pt-BR")}
                            </td>
                            <td>
                              <span className={`rounded-full px-3 py-1 font-bold ${st.painel}`}>
                                {indicador ? valorFormatado(resultado, indicador) : "-"}
                              </span>
                            </td>
                            <td>
                              {r.anexos?.length ? (
                                <div className="space-y-1">
                                  {r.anexos.map((arquivo, index) => (
                                    <a
                                      key={index}
                                      href={arquivo.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block font-bold text-cyan-300"
                                    >
                                      {arquivo.nome}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">Sem anexo</span>
                              )}
                            </td>
                            <td>
                              <button
                                onClick={() => removerRegistro(r.id)}
                                className="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-300"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}

        {aba === "tv" && (
          <section className="rounded-[2rem] border border-slate-700/40 bg-slate-950/55 p-8 text-white shadow-[0_0_45px_rgba(0,80,255,0.18)] backdrop-blur-xl">
            <p className="text-slate-400">Modo TV Operacional | {periodoSelecionado.label}</p>
            <h2 className="text-4xl font-bold">Performance - {setorFiltro}</h2>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
                <p className="text-slate-300">Indicadores</p>
                <h3 className="mt-2 text-5xl font-bold">{resumoIndicadores.length}</h3>
              </div>

              <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
                <p className="text-slate-300">Dentro da Meta</p>
                <h3 className="mt-2 text-5xl font-bold">{verdes}</h3>
              </div>

              <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
                <p className="text-slate-300">Fora da Meta</p>
                <h3 className="mt-2 text-5xl font-bold">{vermelhos}</h3>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {resumoIndicadores.map((i) => (
                <div key={i.id} className={`rounded-2xl p-6 ${i.status.painel}`}>
                  <p className="text-sm opacity-80">
                    Meta: {i.regraMeta === "menor" ? "até" : "mínimo"} {i.meta}
                    {i.unidade}
                  </p>
                  <h4 className="text-2xl font-bold">{i.indicador}</h4>
                  <p className="mt-3 text-5xl font-bold">{valorFormatado(i.resultado, i)}</p>
                  <Badge className="mt-4 border-white bg-white/20 text-white">
                    {i.status.texto}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
