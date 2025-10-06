(function(){
  // Expose required API
  window.CHALLENGE_GRADER = { check, grade };

  // ---------- Utilities ----------
  function makeDB(SQL, seedSQL){
    const db = new SQL.Database();
    db.run(seedSQL);
    return db;
  }
  function run(db, sql){
    const res = db.exec(sql);
    return res.length ? res[0] : { columns: [], values: [] };
  }
  function rowsToObjects(res){
    const cols = res.columns || [];
    const out = [];
    for (const row of (res.values || [])){
      const obj = {};
      for (let i=0;i<cols.length;i++){
        const v = row[i];
        obj[cols[i]] = (v === undefined) ? null : v;
      }
      out.push(obj);
    }
    return out;
  }
  function sortRows(rows, cols){
    const keys = cols && cols.length ? cols : Object.keys(rows[0] || {});
    return rows.slice().sort((a,b)=>{
      for (const k of keys){
        const av = a[k]; const bv = b[k];
        if (av === bv) continue;
        if (av === null) return -1;
        if (bv === null) return 1;
        if (av < bv) return -1;
        if (av > bv) return 1;
      }
      return 0;
    });
  }
  function normalize(res){
    const rows = rowsToObjects(res);
    const cols = res.columns || (rows[0] ? Object.keys(rows[0]) : []);
    const sorted = sortRows(rows, cols);
    return { columns: cols, rows: sorted };
  }
  function sameColumns(aCols, bCols){
    if (aCols.length !== bCols.length) return false;
    for (let i=0;i<aCols.length;i++){
      if (String(aCols[i]) !== String(bCols[i])) return false;
    }
    return true;
  }
  function shallowEqualRow(a, b, cols){
    for (const c of cols){
      const av = a[c], bv = b[c];
      if (av === bv) continue;
      // null vs 'null' mismatch handling
      if ((av === null && bv === 'null') || (bv === null && av === 'null')) continue;
      return false;
    }
    return true;
  }
  function compare(exp, got){
    const A = normalize(exp), B = normalize(got);
    const sameCols = sameColumns(A.columns, B.columns);
    const sameLen = A.rows.length === B.rows.length;
    let sameRows = sameLen && sameCols;
    if (sameRows){
      for (let i=0;i<A.rows.length;i++){
        if (!shallowEqualRow(A.rows[i], B.rows[i], A.columns)){ sameRows = false; break; }
      }
    }
    const ok = sameCols && sameRows;
    return { ok, A, B, sameCols, sameLen };
  }
  function htmlTable(rows, cols, title){
    if (!rows.length) return `<div><b>${title}</b>: (0 rows)</div>`;
    let h = `<div style="margin:6px 0"><b>${title}</b>:</div>`;
    h += '<div class="table-wrap"><table><thead><tr>';
    h += '<th class="col-idx">#</th>';
    for (const c of cols) h += `<th>${c}</th>`;
    h += '</tr></thead><tbody>';
    for (let i=0;i<rows.length;i++){
      const r = rows[i];
      h += `<tr><td class="col-idx">${i+1}</td>`;
      for (const c of cols){ 
        const v = r[c];
        h += `<td>${v === null ? '<i>null</i>' : String(v)}</td>`;
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    return h;
  }
  function diffHTML(cmp, maxRows = 20){
    const expRows = cmp.A.rows.slice(0, maxRows);
    const gotRows = cmp.B.rows.slice(0, maxRows);
    const cols = cmp.A.columns.length ? cmp.A.columns : cmp.B.columns;
    let h = '';
    if (!cmp.sameCols){
      h += `<div class="warn">Columns differ.</div>`;
      h += htmlTable([Object.fromEntries(cols.map(c=>[c,c]))], cols, 'Expected columns') +
           htmlTable([Object.fromEntries((cmp.B.columns||[]).map(c=>[c,c]))], (cmp.B.columns||[]), 'Your columns');
    }
    if (cmp.sameCols && !cmp.sameLen){
      h += `<div class="warn">Row count differs: expected ${cmp.A.rows.length}, got ${cmp.B.rows.length}.</div>`;
    }
    if (cmp.sameCols && !cmp.ok){
      h += htmlTable(expRows, cols, 'Expected (sample)') + htmlTable(gotRows, cols, 'Your result (sample)');
    }
    return h;
  }

  // ---------- Reference SQL per stage ----------
  // Adjust these if your seed uses different column names.
  const REF = {
    // Stage 1: accounts in telemetry but NOT in active deployments
    '1A': `
WITH cloud_active AS (
  SELECT DISTINCT account_id
  FROM deployments
  WHERE active_to IS NULL
),
tele AS (
  SELECT DISTINCT account_id
  FROM telemetry
)
SELECT t.account_id
FROM tele t
LEFT JOIN cloud_active c USING (account_id)
WHERE c.account_id IS NULL
ORDER BY t.account_id;
`,

    // Stage 2: flags + source_of_truth per account
    '2': `
WITH cloud_active AS (
  SELECT DISTINCT account_id
  FROM deployments
  WHERE active_to IS NULL
),
tele AS (
  SELECT DISTINCT account_id
  FROM telemetry
)
SELECT
  a.account_id,
  CASE WHEN c.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_cloud_flag,
  CASE WHEN t.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_onprem_flag,
  CASE
    WHEN c.account_id IS NOT NULL AND t.account_id IS NOT NULL THEN 'both'
    WHEN c.account_id IS NOT NULL THEN 'cloud_only'
    WHEN t.account_id IS NOT NULL THEN 'onprem_only'
    ELSE 'none'
  END AS source_of_truth
FROM accounts a
LEFT JOIN cloud_active c USING (account_id)
LEFT JOIN tele t USING (account_id)
ORDER BY a.account_id;
`,

    // Stage 3: roll-up to customer
    '3': `
WITH cloud_active AS (
  SELECT DISTINCT account_id
  FROM deployments
  WHERE active_to IS NULL
),
tele AS (
  SELECT DISTINCT account_id
  FROM telemetry
),
flags AS (
  SELECT
    a.account_id,
    a.customer_id,
    CASE WHEN c.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_cloud_flag,
    CASE WHEN t.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_onprem_flag
  FROM accounts a
  LEFT JOIN cloud_active c USING (account_id)
  LEFT JOIN tele t USING (account_id)
),
cust AS (
  SELECT
    customer_id,
    MAX(has_cloud_flag) AS any_cloud,
    MAX(has_onprem_flag) AS any_onprem
  FROM flags
  GROUP BY customer_id
)
SELECT
  customer_id,
  CASE
    WHEN any_cloud=1 AND any_onprem=1 THEN 'Hybrid'
    WHEN any_cloud=1 THEN 'Cloud'
    WHEN any_onprem=1 THEN 'OnPrem'
    ELSE 'None'
  END AS deployment_model
FROM cust
ORDER BY customer_id;
`
  };

  // ---------- Public API ----------
  async function check(partId, userSQL, seedSQL, SQL){
    // Build DBs
    const dbExp = makeDB(SQL, seedSQL);
    const dbUser = makeDB(SQL, seedSQL);

    // Run reference + user
    let exp, got, status;
    try {
      if (!REF[partId]) return { ok:false, status:'No checker for this stage.' };
      exp = run(dbExp, REF[partId]);
    } catch (e){
      return { ok:false, status:'Internal reference failed: ' + e.message };
    }
    try {
      got = run(dbUser, userSQL);
    } catch (e){
      return { ok:false, status:'Your query error: ' + e.message };
    }

    const cmp = compare(exp, got);
    if (cmp.ok){
      const label = partId==='1A' ? 'Stage 1' : partId==='2' ? 'Stage 2' : 'Stage 3';
      status = `✅ Passed (${label})`;
      return { ok:true, status };
    } else {
      status = 'Not correct — see differences below.';
      return { ok:false, status, diffHTML: diffHTML(cmp) };
    }
  }

  async function grade(userSQL, seedSQL, SQL){
    // Final grading = Stage 3
    return check('3', userSQL, seedSQL, SQL);
  }
})();
