<script>
// Grader for "deployment-distribution-v1"
(function(){
  function resultToRows(res){
    if (!res || !res.columns) return [];
    const cols = res.columns.map(String);
    return res.values.map(r => {
      const o = {};
      for (let i=0;i<cols.length;i++){
        let v = r[i];
        // Normalize booleans and ints
        if (typeof v === 'string') {
          const s = v.trim().toLowerCase();
          if (s === 'true') v = 1;
          if (s === 'false') v = 0;
        }
        if (v === true) v = 1;
        if (v === false) v = 0;
        o[cols[i]] = v;
      }
      return o;
    });
  }

  function sortRows(rows, keys){
    if (!rows.length) return rows.slice();
    const k = keys && keys.length ? keys : Object.keys(rows[0]);
    return rows.slice().sort((a,b)=>{
      for (const key of k){
        const av = a[key], bv = b[key];
        if (av === bv) continue;
        return (av < bv) ? -1 : 1;
      }
      return 0;
    });
  }

  function rowsEqual(a,b){
    if (a.length !== b.length) return false;
    const ak = Object.keys(a[0]||{}), bk = Object.keys(b[0]||{});
    if (ak.length !== bk.length) return false;
    const keys = ak.map(String).sort();
    if (JSON.stringify(keys) !== JSON.stringify(bk.map(String).sort())) return false;
    const sa = sortRows(a, keys), sb = sortRows(b, keys);
    for (let i=0;i<sa.length;i++){
      for (const k of keys){
        if (String(sa[i][k]) !== String(sb[i][k])) return false;
      }
    }
    return true;
  }

  function tableHTML(rows, title){
    if (!rows.length) return `<div class="muted">${title || 'Result'}: (0 rows)</div>`;
    const keys = Object.keys(rows[0]);
    let h = `<div class="table-wrap"><table><thead><tr>`;
    h += keys.map(k=>`<th>${k}</th>`).join('');
    h += `</tr></thead><tbody>`;
    for (const r of rows){
      h += `<tr>` + keys.map(k=>`<td>${r[k]===null?'<i>null</i>':String(r[k])}</td>`).join('') + `</tr>`;
    }
    h += `</tbody></table></div>`;
    return h;
  }

  function diffHTML(userRows, expRows){
    // Simple set diff by JSON string; good enough for MVP
    const toKeyed = rows => rows.map(r=>JSON.stringify(r));
    const u = toKeyed(userRows), e = toKeyed(expRows);
    const extra = u.filter(x => !e.includes(x));
    const missing = e.filter(x => !u.includes(x));
    let h = '';
    if (!extra.length && !missing.length) return '';
    if (missing.length){
      h += `<h4>Missing rows</h4>${tableHTML(missing.map(x=>JSON.parse(x)))}`;
    }
    if (extra.length){
      h += `<h4>Extra rows</h4>${tableHTML(extra.map(x=>JSON.parse(x)))}`;
    }
    return h;
  }

  // Reference queries (SQLite)
  const SQLS = {
    part1: `
      WITH current_cloud AS (
        SELECT account_id
        FROM deployments
        WHERE active_to IS NULL
        GROUP BY account_id
      )
      SELECT DISTINCT t.account_id
      FROM telemetry t
      LEFT JOIN current_cloud c USING (account_id)
      WHERE c.account_id IS NULL
      ORDER BY t.account_id;
    `,
    part2: `
      WITH current_cloud AS (
        SELECT account_id
        FROM deployments
        WHERE active_to IS NULL
        GROUP BY account_id
      ),
      flags AS (
        SELECT a.account_id,
               CASE WHEN c.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_cloud_flag,
               CASE WHEN EXISTS (SELECT 1 FROM telemetry t WHERE t.account_id = a.account_id) THEN 1 ELSE 0 END AS has_onprem_flag
        FROM accounts a
        LEFT JOIN current_cloud c ON c.account_id = a.account_id
      )
      SELECT account_id, has_cloud_flag, has_onprem_flag
      FROM flags
      ORDER BY account_id;
    `,
    part3: `
      WITH current_cloud AS (
        SELECT account_id
        FROM deployments
        WHERE active_to IS NULL
        GROUP BY account_id
      ),
      flags AS (
        SELECT a.account_id,
               a.customer_id,
               CASE WHEN c.account_id IS NOT NULL THEN 1 ELSE 0 END AS has_cloud_flag,
               CASE WHEN EXISTS (SELECT 1 FROM telemetry t WHERE t.account_id = a.account_id) THEN 1 ELSE 0 END AS has_onprem_flag
        FROM accounts a
        LEFT JOIN current_cloud c ON c.account_id = a.account_id
      ),
      per_customer AS (
        SELECT customer_id,
               MAX(has_cloud_flag)  AS has_cloud,
               MAX(has_onprem_flag) AS has_onprem
        FROM flags
        GROUP BY customer_id
      )
      SELECT customer_id,
             CASE
               WHEN has_cloud=1 AND has_onprem=1 THEN 'Hybrid'
               WHEN has_cloud=1 AND has_onprem=0 THEN 'Cloud'
               WHEN has_cloud=0 AND has_onprem=1 THEN 'OnPrem'
               ELSE 'None'
             END AS deployment_model
      FROM per_customer
      ORDER BY customer_id;
    `
  };

  function normalizeDeploymentModel(rows){
    for (const r of rows){
      if (!('deployment_model' in r)) continue;
      const s = String(r.deployment_model).toLowerCase();
      if (s.startsWith('hyb')) r.deployment_model = 'Hybrid';
      else if (s.startsWith('cloud')) r.deployment_model = 'Cloud';
      else if (s.startsWith('on') ) r.deployment_model = 'OnPrem'; // onprem, on-prem, on premise
      else r.deployment_model = 'None';
    }
    return rows;
  }

  function project(rows, needed){
    const have = rows.length ? Object.keys(rows[0]).map(x=>x.toLowerCase()) : [];
    const need = needed.map(x=>x.toLowerCase());
    const ok = need.every(n => have.includes(n));
    if (!ok) return null;
    return rows.map(r=>{
      const o = {};
      for (const n of needed){
        const k = Object.keys(r).find(x=>x.toLowerCase()===n.toLowerCase());
        o[n] = r[k];
      }
      return o;
    });
  }

  async function buildDB(seedSQL, SQL){
    const db = new SQL.Database();
    db.run(seedSQL);
    return db;
  }

  function firstSelectResult(db, sql){
    const results = db.exec(sql);
    if (!results || !results.length) return { columns:[], values:[] };
    // take the first result set
    return results[0];
  }

  async function runCompare(userSQL, expSQL, seedSQL, SQL, opts){
    const db1 = await buildDB(seedSQL, SQL);
    const db2 = await buildDB(seedSQL, SQL);

    // expected
    const expRes = firstSelectResult(db1, expSQL);
    let expRows = resultToRows(expRes);

    // user
    const userRes = firstSelectResult(db2, userSQL);
    let userRows = resultToRows(userRes);

    // part-specific normalization
    if (opts && opts.project){
      const pUser = project(userRows, opts.project);
      if (!pUser){
        return {
          ok:false,
          status:`Your result must include columns: ${opts.project.join(', ')}`,
          diffHTML: tableHTML(userRows, 'Your result (columns do not match)')
        };
      }
      userRows = pUser;

      const pExp = project(expRows, opts.project);
      expRows = pExp || expRows;
    }
    if (opts && opts.normalizeDeploymentModel){
      userRows = normalizeDeploymentModel(userRows);
      expRows  = normalizeDeploymentModel(expRows);
    }

    const ok = rowsEqual(userRows, expRows);
    return {
      ok,
      status: ok ? 'Looks good!' : 'Results differ.',
      diffHTML: ok ? '' : (tableHTML(userRows, 'Your result') + tableHTML(expRows, 'Expected') + diffHTML(userRows, expRows))
    };
  }

  async function check(partId, userSQL, seedSQL, SQL){
    const sql = (userSQL||'').trim();
    if (!/^select/i.test(sql)) return { ok:false, status:'Only SELECT queries can be checked.' };

    if (partId === '1A'){
      return runCompare(sql, SQLS.part1, seedSQL, SQL, { project:['account_id'] });
    }
    if (partId === '2'){
      return runCompare(sql, SQLS.part2, seedSQL, SQL, { project:['account_id','has_cloud_flag','has_onprem_flag'] });
    }
    if (partId === '3'){
      return runCompare(sql, SQLS.part3, seedSQL, SQL, { project:['customer_id','deployment_model'], normalizeDeploymentModel:true });
    }
    return { ok:false, status:'Unknown part.' };
  }

  async function grade(userSQL, seedSQL, SQL){
    // Final is Part 3
    return check('3', userSQL, seedSQL, SQL);
  }

  window.CHALLENGE_GRADER = { check, grade };
})();
</script>
