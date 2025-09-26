(function(){
  function makeDB(SQL, seed){ const db = new SQL.Database(); db.run(seed); return db; }
  function execFirst(db, sql){ const r = db.exec(sql.trim()); return r.length ? r[0] : {columns:[],values:[]}; }
  function norm(res, colsWanted){
    const cols = res.columns||[];
    const idx = colsWanted.map(w => cols.findIndex(c => c.toLowerCase()===w.toLowerCase()));
    const miss = colsWanted.filter((_,i)=> idx[i]<0);
    if (miss.length) return { error:'Missing columns: '+miss.join(', ') };
    const rows = (res.values||[]).map(r => idx.map(i => r[i]===null?'__NULL__':String(r[i])));
    const set = new Set(rows.map(r => r.join('\u0001')));
    return { set, cols:colsWanted };
  }
  function diff(user, truth, cols){
    const u = norm(user, cols); if (u.error) return { error:u.error };
    const t = norm(truth, cols); if (t.error) return { error:t.error };
    const missing = [...t.set].filter(x => !u.set.has(x));
    const extra   = [...u.set].filter(x => !t.set.has(x));
    const toTbl = (arr)=>({columns:cols,values:arr.map(s=>s.split('\u0001').map(v=>v==='__NULL__'?null:v))});
    return { ok: !missing.length && !extra.length, missing:toTbl(missing), extra:toTbl(extra) };
  }
  const htmlTbl = (tbl)=>{
    if (!tbl || !tbl.columns) return '<div class="muted">No rows.</div>';
    const head = '<tr><th class="col-idx">#</th>'+tbl.columns.map(c=>`<th>${c}</th>`).join('')+'</tr>';
    const body = (tbl.values||[]).map((row,i)=>'<tr><td class="col-idx">'+(i+1)+'</td>'+row.map(v=>`<td>${v===null?'<i>null</i>':String(v)}</td>`).join('')+'</tr>').join('');
    return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  };

  function truthPart1(db){
    return execFirst(db, `
      WITH current AS (
        SELECT account_id, MAX(DATE(active_from)) AS active_dt
        FROM deployments
        WHERE active_to IS NULL
        GROUP BY account_id
      )
      SELECT DISTINCT t.account_id
      FROM telemetry t
      LEFT JOIN current c USING (account_id)
      WHERE c.account_id IS NULL
      ORDER BY t.account_id
    `);
  }

  function truthFlags(db){
    return execFirst(db, `
      WITH current AS (
        SELECT account_id, model_raw, MAX(DATE(active_from)) AS active_dt
        FROM deployments
        WHERE active_to IS NULL
        GROUP BY account_id
      )
      SELECT a.account_id, a.customer_id,
        CASE WHEN current.account_id IS NOT NULL AND LOWER(current.model_raw) IN ('cloud','saas','hosted','aws','gcp','azure') THEN 1 ELSE 0 END AS has_cloud_flag,
        CASE
          WHEN current.account_id IS NOT NULL AND (
            LOWER(current.model_raw) LIKE '%onprem%' OR LOWER(current.model_raw) LIKE '%on-prem%' OR
            LOWER(current.model_raw) IN ('server','datacenter','self-hosted')
          ) THEN 1
          WHEN current.account_id IS NULL AND EXISTS (SELECT 1 FROM telemetry t WHERE t.account_id=a.account_id) THEN 1
          ELSE 0
        END AS has_onprem_flag,
        CASE
          WHEN current.account_id IS NOT NULL THEN 'Deployment'
          WHEN EXISTS (SELECT 1 FROM telemetry t WHERE t.account_id=a.account_id) THEN 'Telemetry'
          ELSE 'None'
        END AS source_of_truth
      FROM accounts a
      LEFT JOIN current USING (account_id)
      ORDER BY a.customer_id, a.account_id
    `);
  }

  function truthRollup(db){
    return execFirst(db, `
      WITH flags AS (
        ${truthFlags(makeDB(SQL, '')) ? `
        SELECT a.account_id, a.customer_id,
          CASE WHEN c.account_id IS NOT NULL AND LOWER(c.model_raw) IN ('cloud','saas','hosted','aws','gcp','azure') THEN 1 ELSE 0 END AS has_cloud_flag,
          CASE
            WHEN c.account_id IS NOT NULL AND (
              LOWER(c.model_raw) LIKE '%onprem%' OR LOWER(c.model_raw) LIKE '%on-prem%' OR
              LOWER(c.model_raw) IN ('server','datacenter','self-hosted')
            ) THEN 1
            WHEN c.account_id IS NULL AND EXISTS (SELECT 1 FROM telemetry t WHERE t.account_id=a.account_id) THEN 1
            ELSE 0
          END AS has_onprem_flag
        FROM accounts a
        LEFT JOIN (
          SELECT account_id, model_raw, MAX(DATE(active_from)) AS active_dt
          FROM deployments
          WHERE active_to IS NULL
          GROUP BY account_id
        ) c USING (account_id)
        ` : 'SELECT 1 WHERE 0'}
      )
      SELECT c.customer_id,
        CASE
          WHEN SUM(has_cloud_flag)>0 AND SUM(has_onprem_flag)>0 THEN 'Hybrid'
          WHEN SUM(has_cloud_flag)>0 THEN 'Cloud'
          WHEN SUM(has_onprem_flag)>0 THEN 'OnPrem'
          ELSE 'None'
        END AS deployment_model
      FROM flags f
      JOIN accounts a USING (account_id)
      JOIN customers c USING (customer_id)
      GROUP BY c.customer_id
      ORDER BY c.customer_id
    `);
  }

  async function check(partId, userSQL, seedSQL, SQL){
    const dbT = makeDB(SQL, seedSQL);
    const dbU = makeDB(SQL, seedSQL);
    let truth, cols;
    if (partId==='1A'){ truth = truthPart1(dbT); cols=['account_id']; }
    else if (partId==='2'){ truth = truthFlags(dbT); cols=['account_id','customer_id','has_cloud_flag','has_onprem_flag','source_of_truth']; }
    else if (partId==='3'){ truth = truthRollup(dbT); cols=['customer_id','deployment_model']; }
    else return { ok:false, status:'Unknown part.' };

    let user; try { user = execFirst(dbU, `SELECT * FROM (${userSQL})`); }
    catch(e){ return { ok:false, status:'Query error: '+e.message }; }

    const d = diff(user, truth, cols);
    if (d.error) return { ok:false, status:d.error };
    if (d.ok) return { ok:true, status:'✅ Passed!' };

    let html=''; if (d.missing.values.length) html += '<div class="muted">Missing rows (truth − yours):</div>'+htmlTbl(d.missing);
    if (d.extra.values.length) html += '<div class="muted">Extra rows (yours − truth):</div>'+htmlTbl(d.extra);
    return { ok:false, status:'❌ Not correct.', diffHTML:html };
  }

  async function grade(userSQL, seedSQL, SQL){ return check('3', userSQL, seedSQL, SQL); }

  window.CHALLENGE_GRADER = { check, grade };
})();
