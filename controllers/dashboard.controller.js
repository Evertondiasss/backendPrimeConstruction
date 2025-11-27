// controllers/dashboard.controller.js
import pool from '../config/db.js';

export async function getDashboard(req, res) {
  try {
    const { mes, ano, obra } = req.query;

    const mesInt  = mes  ? parseInt(mes, 10)  : null;
    const anoInt  = ano  ? parseInt(ano, 10)  : null;
    const obraId  = obra ? parseInt(obra, 10) : null;

    // ============================================================
    // 1) RECEITAS (recebimentos_obra)
    // ============================================================
    let whereReceitas = 'WHERE 1=1';
    const paramsReceitas = [];

    if (obraId) {
      whereReceitas += ' AND obra_id = ?';
      paramsReceitas.push(obraId);
    }
    if (anoInt) {
      whereReceitas += ' AND YEAR(data_recebimento) = ?';
      paramsReceitas.push(anoInt);
    }
    if (mesInt) {
      whereReceitas += ' AND MONTH(data_recebimento) = ?';
      paramsReceitas.push(mesInt);
    }

    const [receitasResumoRows] = await pool.query(
      `
        SELECT COALESCE(SUM(valor), 0) AS receitaTotal
        FROM recebimentos_obra
        ${whereReceitas}
      `,
      paramsReceitas
    );

    const receitaTotal = Number(receitasResumoRows[0]?.receitaTotal || 0);

    // ============================================================
    // 2) DESPESAS - COMPRAS
    // ============================================================
    let whereCompras = 'WHERE 1=1';
    const paramsCompras = [];

    if (obraId) {
      whereCompras += ' AND obra_id = ?';
      paramsCompras.push(obraId);
    }
    if (anoInt) {
      whereCompras += ' AND YEAR(data_compra) = ?';
      paramsCompras.push(anoInt);
    }
    if (mesInt) {
      whereCompras += ' AND MONTH(data_compra) = ?';
      paramsCompras.push(mesInt);
    }

    const [comprasResumoRows] = await pool.query(
      `
        SELECT COALESCE(SUM(total_liquido), 0) AS totalCompras
        FROM compras
        ${whereCompras}
      `,
      paramsCompras
    );

    const totalCompras = Number(comprasResumoRows[0]?.totalCompras || 0);

    // ============================================================
    // 2.2 ENCARGOS
    // ============================================================
    let whereEncargos = 'WHERE 1=1';
    const paramsEncargos = [];

    if (obraId) {
      whereEncargos += ' AND obra_id = ?';
      paramsEncargos.push(obraId);
    }
    if (anoInt) {
      whereEncargos += ' AND YEAR(created_at) = ?';
      paramsEncargos.push(anoInt);
    }
    if (mesInt) {
      whereEncargos += ' AND MONTH(created_at) = ?';
      paramsEncargos.push(mesInt);
    }

    const [encargosResumoRows] = await pool.query(
      `
        SELECT COALESCE(SUM(valor), 0) AS totalEncargos
        FROM encargos
        ${whereEncargos}
      `,
      paramsEncargos
    );

    const totalEncargos = Number(encargosResumoRows[0]?.totalEncargos || 0);

    // ============================================================
    // 2.3 PAGAMENTOS DE FUNCIONÁRIOS
    // ============================================================
    let wherePagFunc = 'WHERE 1=1';
    const paramsPagFunc = [];

    if (anoInt) {
      wherePagFunc += ' AND YEAR(competencia) = ?';
      paramsPagFunc.push(anoInt);
    }
    if (mesInt) {
      wherePagFunc += ' AND MONTH(competencia) = ?';
      paramsPagFunc.push(mesInt);
    }

    const [pagFuncResumoRows] = await pool.query(
      `
        SELECT COALESCE(SUM(valor_pago + COALESCE(extras_total, 0)), 0) AS totalPagFunc
        FROM pagamentos_funcionarios
        ${wherePagFunc}
      `,
      paramsPagFunc
    );

    const totalPagFunc = Number(pagFuncResumoRows[0]?.totalPagFunc || 0);

    // ============================================================
    // TOTAL DESPESAS + LUCRO
    // ============================================================
    const despesaTotal = totalCompras + totalEncargos + totalPagFunc;
    const lucroTotal   = receitaTotal - despesaTotal;

    // ============================================================
    // 3) OBRAS ATIVAS
    // ============================================================
    let whereObrasAtivas = `WHERE status = 'ativa'`;
    const paramsObrasAtivas = [];

    if (obraId) {
      whereObrasAtivas += ' AND id = ?';
      paramsObrasAtivas.push(obraId);
    }

    const [obrasAtivasRows] = await pool.query(
      `
        SELECT COUNT(*) AS totalObrasAtivas
        FROM obras
        ${whereObrasAtivas}
      `,
      paramsObrasAtivas
    );

    const totalObrasAtivas = obrasAtivasRows[0]?.totalObrasAtivas || 0;

    // ============================================================
    // 4) RECEITAS MENSAIS
    // ============================================================
    const [receitasMensaisRows] = await pool.query(
      `
        SELECT
          YEAR(data_recebimento) AS ano,
          MONTH(data_recebimento) AS mes,
          COALESCE(SUM(valor), 0) AS total
        FROM recebimentos_obra
        ${whereReceitas}
        GROUP BY ano, mes
        ORDER BY ano, mes
      `,
      paramsReceitas
    );

    // ============================================================
    // 5) DESPESAS MENSAIS
    // ============================================================
    const [comprasMensaisRows] = await pool.query(
      `
        SELECT
          YEAR(data_compra) AS ano,
          MONTH(data_compra) AS mes,
          COALESCE(SUM(total_liquido), 0) AS total
        FROM compras
        ${whereCompras}
        GROUP BY ano, mes
        ORDER BY ano, mes
      `,
      paramsCompras
    );

    const [encargosMensaisRows] = await pool.query(
      `
        SELECT
          YEAR(created_at) AS ano,
          MONTH(created_at) AS mes,
          COALESCE(SUM(valor), 0) AS total
        FROM encargos
        ${whereEncargos}
        GROUP BY ano, mes
        ORDER BY ano, mes
      `,
      paramsEncargos
    );

    const [pagFuncMensaisRows] = await pool.query(
      `
        SELECT
          YEAR(competencia) AS ano,
          MONTH(competencia) AS mes,
          COALESCE(SUM(valor_pago + COALESCE(extras_total, 0)), 0) AS total
        FROM pagamentos_funcionarios
        ${wherePagFunc}
        GROUP BY ano, mes
        ORDER BY ano, mes
      `,
      paramsPagFunc
    );

    // Agrupamento
    const mapReceitasMes = new Map();
    const mapDespesasMes = new Map();
    const makeKey = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}`;

    receitasMensaisRows.forEach(r => {
      mapReceitasMes.set(makeKey(r.ano, r.mes), Number(r.total) || 0);
    });

    const acumula = rows => {
      rows.forEach(r => {
        const key = makeKey(r.ano, r.mes);
        const atual = mapDespesasMes.get(key) || 0;
        mapDespesasMes.set(key, atual + (Number(r.total) || 0));
      });
    };

    acumula(comprasMensaisRows);
    acumula(encargosMensaisRows);
    acumula(pagFuncMensaisRows);

    const keysOrdenadas = [...new Set([
      ...mapReceitasMes.keys(),
      ...mapDespesasMes.keys()
    ])].sort();

    const labelsFinanceiro = [];
    const receitasChart = [];
    const despesasChart = [];

    keysOrdenadas.forEach(key => {
      const [anoK, mesK] = key.split('-');
      labelsFinanceiro.push(`${mesK}/${anoK}`);
      receitasChart.push(mapReceitasMes.get(key) || 0);
      despesasChart.push(mapDespesasMes.get(key) || 0);
    });

    // ============================================================
    // 6) DISTRIBUIÇÃO DE DESPESAS (DONUT)
    // ============================================================
    const distLabels  = ['Materiais', 'Encargos', 'Funcionários'];
    const distValores = [totalCompras, totalEncargos, totalPagFunc];

    // ============================================================
    // 7) PRÓXIMOS PAGAMENTOS
    // ============================================================
    const [proximosPagamentosRows] = await pool.query(`
      SELECT
        p.id,
        p.numero_parcela,
        p.valor_parcela,
        DATE_FORMAT(p.data_vencimento,'%d/%m/%Y') AS data_vencimento,
        p.status_pagamento,
        f.nome AS fornecedor,
        o.nome AS obra
      FROM parcelas_compra p
      JOIN compras c         ON c.id = p.compra_id
      LEFT JOIN fornecedores f ON f.id = c.fornecedor_id
      JOIN obras o           ON o.id = c.obra_id
      WHERE p.status_pagamento <> 'pago'
      ORDER BY p.data_vencimento ASC, p.id ASC
      LIMIT 5
    `);

    const proximosPagamentos = proximosPagamentosRows.map(r => ({
      fornecedor: r.fornecedor || '-',
      obra:       r.obra || '-',
      parcela:    r.numero_parcela,
      valor:      Number(r.valor_parcela || 0),
      vencimento: r.data_vencimento,
      status:     r.status_pagamento
    }));

    // ============================================================
    // 8) TOP PRODUTOS MAIS COMPRADOS
    // ============================================================
    let whereTop = 'WHERE 1=1';
    const paramsTop = [];

    if (obraId) {
      whereTop += ' AND c.obra_id = ?';
      paramsTop.push(obraId);
    }
    if (anoInt) {
      whereTop += ' AND YEAR(c.data_compra) = ?';
      paramsTop.push(anoInt);
    }
    if (mesInt) {
      whereTop += ' AND MONTH(c.data_compra) = ?';
      paramsTop.push(mesInt);
    }

    const [topProdutosRows] = await pool.query(
      `
        SELECT
          p.nome AS produto,
          COALESCE(SUM(ci.quantidade), 0) AS quantidade,
          COALESCE(SUM(ci.total_item), 0) AS custoTotal
        FROM compras_itens ci
        JOIN compras c   ON c.id = ci.compra_id
        JOIN produtos p  ON p.id = ci.produto_id
        ${whereTop}
        GROUP BY p.id, p.nome
        ORDER BY quantidade DESC
        LIMIT 5
      `,
      paramsTop
    );

    const maxQtd = topProdutosRows.reduce(
      (max, r) => Math.max(max, Number(r.quantidade) || 0),
      0
    ) || 1;

    const topProdutos = topProdutosRows.map(r => ({
      produto: r.produto,
      quantidade: Number(r.quantidade) || 0,
      custoTotal: Number(r.custoTotal) || 0,
      percentualBarra: Math.round(((Number(r.quantidade) || 0) / maxQtd) * 100)
    }));

    // ============================================================
    // 9) TOP SALÁRIOS
    // ============================================================
    let whereSalarios = 'WHERE fo.ativo = 1';
    const paramsSalarios = [];

    if (obraId) {
      whereSalarios += ' AND fo.obra_id = ?';
      paramsSalarios.push(obraId);
    }

    if (anoInt) {
      whereSalarios += ' AND YEAR(pf.competencia) = ?';
      paramsSalarios.push(anoInt);
    }

    if (mesInt) {
      whereSalarios += ' AND MONTH(pf.competencia) = ?';
      paramsSalarios.push(mesInt);
    }

    const [topSalariosRows] = await pool.query(
      `
        SELECT
          f.nome AS funcionario,
          fo.cargo_na_obRA AS cargo,
          o.nome AS obra,
          (pf.valor_pago + COALESCE(pf.extras_total, 0)) AS totalPago
        FROM pagamentos_funcionarios pf
        JOIN funcionarios f        ON f.id = pf.funcionario_id
        JOIN funcionario_obras fo  ON fo.funcionario_id = f.id AND fo.ativo = 1
        JOIN obras o               ON o.id = fo.obra_id
        ${whereSalarios}
        ORDER BY totalPago DESC
        LIMIT 5
      `,
      paramsSalarios
    );

    const topSalarios = topSalariosRows.map(r => ({
      funcionario: r.funcionario,
      cargo: r.cargo,
      obra: r.obra,
      totalPago: Number(r.totalPago || 0)
    }));

    // ============================================================
    // RESPOSTA FINAL
    // ============================================================
    res.json({
      resumo: {
        receitaTotal,
        despesaTotal,
        lucroTotal,
        totalObrasAtivas
      },
      graficos: {
        financeiroMensal: {
          labels: labelsFinanceiro,
          receitas: receitasChart,
          despesas: despesasChart
        },
        distribuicaoDespesas: {
          labels: distLabels,
          valores: distValores
        }
      },
      proximosPagamentos,
      topProdutos,
      topSalarios
    });

  } catch (error) {
    console.error('Erro ao montar dashboard:', error);
    res.status(500).json({ error: 'Erro ao montar dashboard' });
  }
}
