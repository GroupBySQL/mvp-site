(function(){
  // tiny helpers
  const isSelectLike = (sql) => {
    const s = String(sql)
      .replace(/\/\*[\s\S]*?\*\//g,'')
      .replace(/^\s*--.*$/gm,'')
      .trim().toLowerCase();
    return s.startsWith('select') || s.startsWith('with');
  };

  function execAll(db, sql){
    try { return db.exec(sql); } catch(e){ return { error: e.message }; }
  }

  function rowsFrom(res){
    if (!res || !res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map(r => {
      const obj = {};
      cols.forEach((c,i)=> obj[c] = r[i]);
      return obj;
    });
  }

  function normRows(rows){
    // stringify values; keep only plain JS types
    return rows.map(r=>{
      const o = {};
      Object.keys(r).forEach(k => { o[k.toLowerCase()] = (r[k]===null? null : String(r[k])); });
      return o;
    });
  }

  function sortRows(rows){
    return rows.slice().sort((a,b)=>{
      const ka = Object.values(a).join('|');
      const kb = Object.values(b).join('|');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  function toTableHTML(rows, title){
    if (!rows.length) return `<div><strong>${title}</strong><div class="muted">0 rows</div></div>`;
    const cols = Object.keys(rows[0]);
    let html = `<div style="margin:6px 0"><strong>${title}</strong><div class="table-wrap"><table><thead><tr>`;
    html += '<th class="col-idx">#</th>' + cols.map(c=>`<th>${c}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach((r,i)=>{
      html += `<tr><td class="col-idx">${i+1}</td>` + cols.map(c=>`<td>${r[c]??''}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  function diffHTML(expected, got){
    const e = toTableHTML(expected,'Expected');
    const g = toTableHTML(got,'Your result');
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${e}${g}</div>`;
  }

  // Build expected answers in SQL on a fresh DB
  function buildExpected(SQL, seedSQL){
    const db = new SQL.Database();
    db.run(seedSQL);

    // Stage 1: accounts in telemetry but NOT in active cloud
    const s1 = db.exec(`
      WITH active_cloud AS (
        SELECT DISTINCT account_id
        FROM deployments
        WHERE deployment_type='cloud' AND active_to IS NULL
      )
      SELECT DISTINCT t.account_id
      FROM telemetry t
      LEFT JOIN active_cloud c ON c.account_id = t.account_id
      WHERE c.account_id IS NULL
      ORDER BY t.account_id;
    `);

    // Stage 2: flags per account
    const s2 = db.exec(`
      WITH active_cloud AS (
        SELECT DISTINCT account_id
        FROM deployments
        WHERE deployment_type='cloud' AND active_to IS NULL
      ),
      has_onprem AS (
        SELECT DISTINCT account_id FROM telemetry
      )
      SELECT a.account_id,
             CASE WHEN ac.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_active_cloud,
             CASE WHEN ho.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_onprem
      FROM accounts a
      LEFT JOIN active_cloud ac ON ac.account_id = a.account_id
      LEFT JOIN has_onprem ho ON ho.account_id = a.account_id
      ORDER BY a.account_id;
    `);

    // Stage 3: roll-up per customer (no None in this dataset)
    const s3 = db.exec(`
      WITH flags AS (
        WITH active_cloud AS (
          SELECT DISTINCT account_id
          FROM deployments
          WHERE deployment_type='cloud' AND active_to IS NULL
        ),
        has_onprem AS (
          SELECT DISTINCT account_id FROM telemetry
        )
        SELECT a.customer_id, a.account_id,
               CASE WHEN ac.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_active_cloud,
               CASE WHEN ho.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_onprem
        FROM accounts a
        LEFT JOIN active_cloud ac ON ac.account_id = a.account_id
        LEFT JOIN has_onprem ho ON ho.account_id = a.account_id
      )
      SELECT c.customer_id,
             CASE
               WHEN MAX(has_active_cloud)=1 AND MAX(has_onprem)=1 THEN 'Hybrid'
               WHEN MAX(has_active_cloud)=1 THEN 'Cloud'
               ELSE 'OnPrem'
             END AS deployment_model
      FROM customers c
      JOIN flags f ON f.customer_id = c.customer_id
      GROUP BY c.customer_id
      ORDER BY c.customer_id;
    `);

    // Bonus: migrated = has active cloud and that cloud started AFTER last on-prem seen
    const sB = db.exec(`
      WITH last_onprem AS (
        SELECT a.customer_id, MAX(t.seen_at) AS last_onprem_seen_at
        FROM accounts a
        JOIN telemetry t ON t.account_id = a.account_id
        GROUP BY a.customer_id
      ),
      cloud_now AS (
        SELECT a.customer_id, MIN(d.active_from) AS cloud_active_from
        FROM accounts a
        JOIN deployments d ON d.account_id = a.account_id
        WHERE d.deployment_type='cloud' AND d.active_to IS NULL
        GROUP BY a.customer_id
      )
      SELECT c.customer_id, l.last_onprem_seen_at, cn.cloud_active_from
      FROM customers c
      JOIN cloud_now cn ON cn.customer_id = c.customer_id
      JOIN last_onprem l ON l.customer_id = c.customer_id
      WHERE cn.cloud_active_from > l.last_onprem_seen_at
      ORDER BY c.customer_id;
    `);

    return {
      s1: normRows(rowsFrom(s1)),
      s2: normRows(rowsFrom(s2)),
      s3: normRows(rowsFrom(s3)),
      sb: normRows(rowsFrom(sB))
    };
  }

  function compare(expected, got){
    const E = sortRows(expected);
    const G = sortRows(normRows(got));
    const sameLen = E.length === G.length;
    const sameData = sameLen && JSON.stringify(E) === JSON.stringify(G);
    return { ok: sameData, expected: E, got: G };
  }

  async function gradePart(partId, userSQL, seedSQL, SQL){
    const exp = buildExpected(SQL, seedSQL);
    const db = new SQL.Database();
    db.run(seedSQL);
    const res = execAll(db, userSQL);
    if (res.error) return { ok:false, status: 'Error running your SQL: ' + res.error };

    const rows = rowsFrom(res);
    if (!rows.length && partId !== '3') {
      // allow empty only if expected empty
    }

    let cmp;
    if (partId === '1A') cmp = compare(exp.s1, rows);
    else if (partId === '2') cmp = compare(exp.s2, rows);
    else if (partId === '3') cmp = compare(exp.s3, rows);
    else if (partId === 'B') cmp = compare(exp.sb, rows);
    else return { ok:false, status:'Unknown stage' };

    return {
      ok: cmp.ok,
      status: cmp.ok ? 'Looks good!' : 'Mismatch — see diff.',
      diffHTML: cmp.ok ? '' : diffHTML(cmp.expected, cmp.got)
    };
  }

  window.CHALLENGE_GRADER = {
    async check(partId, userSQL, seedSQL, SQL){
      if (!isSelectLike(userSQL)) return { ok:false, status:'Write a SELECT (or WITH … SELECT) query.' };
      return gradePart(partId, userSQL, seedSQL, SQL);
    },
    async grade(userSQL, seedSQL, SQL){
      if (!isSelectLike(userSQL)) return { ok:false, status:'Only SELECT (or WITH … SELECT) queries can be submitted.' };
      // For final submit we grade Stage 3 result
      return gradePart('3', userSQL, seedSQL, SQL);
    }
  };
})();
