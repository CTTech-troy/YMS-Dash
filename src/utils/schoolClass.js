function pickClassString(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (Array.isArray(v)) {
    if (v.length === 0) return '';
    const x = v[0];
    if (x && typeof x === 'object') {
      return String(x.name ?? x.label ?? x.title ?? x.className ?? '').trim();
    }
    return String(x ?? '').trim();
  }
  if (typeof v === 'object') {
    return String(v.name ?? v.label ?? v.title ?? v.className ?? '').trim();
  }
  return '';
}

export function resolveClassFromRecord(record) {
  if (record == null || record === '') return '';
  if (typeof record === 'string' || typeof record === 'number') {
    return String(record).trim();
  }
  if (typeof record !== 'object') return '';
  if (Array.isArray(record)) {
    return pickClassString(record);
  }

  const direct =
    pickClassString(record.class) ||
    pickClassString(record.assignedClass) ||
    pickClassString(record.classAssigned) ||
    pickClassString(record.studentClass) ||
    pickClassString(record.className) ||
    pickClassString(record.grade) ||
    pickClassString(record.classroom) ||
    pickClassString(record.class_group) ||
    pickClassString(record.classNameRaw) ||
    pickClassString(record.classLabel) ||
    pickClassString(record.level) ||
    pickClassString(record.data?.class) ||
    pickClassString(record.data?.studentClass) ||
    pickClassString(record.data?.className) ||
    '';

  return direct;
}

export function normalizeClassLabel(value) {
  const raw =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? resolveClassFromRecord(value)
      : String(value ?? '').trim();
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function canonicalClassKey(value) {
  if (value == null || value === '') return '';
  let raw = '';
  if (typeof value === 'object' && value !== null) {
    raw = resolveClassFromRecord(value);
  } else {
    raw = String(value).trim();
  }
  return raw.toLowerCase().replace(/\s+/g, '');
}

export function classesMatch(a, b) {
  const ka = canonicalClassKey(a);
  const kb = canonicalClassKey(b);
  if (!ka || !kb) return false;
  return ka === kb;
}
