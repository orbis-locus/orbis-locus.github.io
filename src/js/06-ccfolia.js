/* ================= ココフォリア出力 ================= */
function damageText(dmg, db) {
  const dbs = db === '0' ? '' : db;
  return String(dmg || '').replace(/\s*\+\s*DB/gi, dbs).replace(/DB/gi, dbs);
}
function buildCommands(c, d) {
  const S = SYS[c.system], cmd = S.cmd, a = d.a, L = [];
  L.push(`${cmd}<={SAN} 【SANチェック】`);
  if (c.system === 'coc6') L.push(`${cmd}<=${d.idea} 【アイデア】`, `${cmd}<=${d.luck} 【幸運】`, `${cmd}<=${d.know} 【知識】`);
  else L.push(`${cmd}<={幸運} 【幸運】`, `${cmd}<=${d.idea} 【アイデア】`, `${cmd}<=${d.know} 【知識】`);
  const skills = c.skills
    .filter(s => s.name && skillTotal(s, a) > 0)
    .filter(s => state.paletteAll || s.isJob || ALWAYS.includes(s.name) || skillTotal(s, a) !== skillInit(s, a));
  CATS.forEach(([cat]) => skills.filter(s => s.cat === cat).forEach(s => L.push(`${cmd}<=${skillTotal(s, a)} 【${skillLabel(s)}】`)));
  c.weapons.filter(w => w.name).forEach(w => {
    if (w.rate) L.push(`${cmd}<=${w.rate} 【${w.name}】`);
    if (w.damage) L.push(`${damageText(w.damage, d.db)} 【${w.name} ダメージ】`);
  });
  if (c.system === 'coc6') S.abil.forEach(([k]) => L.push(`${cmd}<={${k}}*5 【${k} × 5】`));
  else S.abil.filter(([k]) => k !== 'LUCK').forEach(([k]) => L.push(`${cmd}<={${k}} 【${k}】`));
  (c.extra || '').split('\n').map(l => l.trimEnd()).filter(Boolean).forEach(l => L.push(l));
  return L.join('\n');
}
function buildMemo(c, d) {
  const p = c.profile;
  const pair = (k, v) => v ? `${k}：${v}` : '';
  const line = arr => arr.filter(Boolean).join(' / ');
  const lines = [
    p.kana,
    line([pair('職業', p.occupation), pair('年齢', p.age), pair('誕生日', p.birthday), pair('性別', p.sex)]),
    line([pair('身長', p.height), pair('体重', p.weight), pair('出身', p.origin)]),
    line([pair('髪', p.hair), pair('瞳', p.eyes), pair('肌', p.skin)]),
    p.player ? 'PL：' + p.player : '',
    'DB：' + d.db + (c.system === 'coc7' ? ` / ビルド：${d.build} / MOV：${d.mov}` : ''),
  ].filter(Boolean);
  return [lines.join('\n'), c.memo].filter(Boolean).join('\n\n');
}
function toCcfolia(c) {
  const d = compute(c), S = SYS[c.system];
  const status = [{ label: 'HP', value: d.hp, max: d.hpMax }, { label: 'MP', value: d.mp, max: d.mpMax }, { label: 'SAN', value: d.san, max: d.sanMax }];
  if (c.system === 'coc7') status.push({ label: '幸運', value: d.a.LUCK, max: 99 });
  const params = S.abil.filter(([k]) => k !== 'LUCK').map(([k]) => ({ label: k, value: String(d.a[k]) }));
  params.push({ label: 'DB', value: d.db });
  return {
    kind: 'character',
    data: {
      name: c.profile.name || '名無し',
      initiative: d.a.DEX,
      externalUrl: c.profile.externalUrl || '',
      iconUrl: c.profile.iconUrl || null,
      color: c.profile.color || '',
      memo: buildMemo(c, d),
      commands: buildCommands(c, d),
      status, params,
      secret: false, invisible: false, hideStatus: false,
    },
  };
}
