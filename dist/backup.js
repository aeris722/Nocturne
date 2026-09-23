'use strict';
// Shared by file restore and local storage loading. Validation never changes live data.
const NocturneBackup = (() => {
  const MAX_BYTES = 10 * 1024 * 1024;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw new Error(message); };
  const date = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const text = (value, limit) => {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > limit) fail('This backup contains invalid exam details.');
    return value;
  };
  const percent = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  function normalizeState(input) {
    if (!object(input) || !object(input.days) || !Array.isArray(input.exams) || input.exams.length > 2) fail('This file is missing valid journal data.');
    const days = {};
    for (const [key, record] of Object.entries(input.days)) {
      if (!date(key) || !object(record) || !object(record.tasks) || !Number.isInteger(record.water) || record.water < 0 || record.water > 4) fail('This backup contains an invalid daily record.');
      const tasks = {};
      for (const [id, entry] of Object.entries(record.tasks)) {
        if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id) || ['constructor','prototype'].includes(id) || !object(entry) || !['done','missed'].includes(entry.status)) fail('This backup contains an invalid task.');
        const rating = entry.rating ?? (entry.status === 'done' ? 100 : 0);
        if (!percent(rating)) fail('Task ratings must be between 0 and 100.');
        tasks[id] = {status:entry.status, rating};
        if (entry.subjects !== undefined) {
          if (!Array.isArray(entry.subjects) || entry.subjects.length !== 3 || !entry.subjects.every(percent)) fail('This backup contains invalid class ratings.');
          tasks[id].subjects = [...entry.subjects];
        }
      }
      days[key] = {tasks,water:record.water};
    }
    const dayModes = {};
    if (input.dayModes !== undefined && !object(input.dayModes)) fail('This backup contains invalid schedule settings.');
    for (const [key, mode] of Object.entries(input.dayModes || {})) {
      if (!date(key) || !['normal','weekend'].includes(mode)) fail('This backup contains invalid schedule settings.');
      dayModes[key] = mode;
    }
    const exams = Array.from({length:2}, (_, i) => {
      const exam = input.exams[i] ?? {};
      if (!object(exam)) fail('This backup contains invalid exam details.');
      const examDate = text(exam.date,10);
      if (examDate && !date(examDate)) fail('This backup contains an invalid exam date.');
      const normalized = {name:text(exam.name,60),date:examDate};
      if (i === 0) normalized.improvements = text(exam.improvements,3000);
      return normalized;
    });
    return {days,dayModes,exams};
  }
  function parse(source) {
    let payload;
    try {payload = JSON.parse(source.replace(/^\uFEFF/,''));} catch {fail('Choose a valid Nocturne JSON backup.');}
    if (!object(payload) || payload.format !== 'nocturne-endurance') fail('Choose a Nocturne backup exported from this app.');
    if (payload.version !== 1) fail('This backup version is not supported.');
    return normalizeState(payload.state);
  }
  function serialize(state) {
    return JSON.stringify({format:'nocturne-endurance',version:1,exportedAt:new Date().toISOString(),state:normalizeState(state)}, null, 2);
  }
  return {MAX_BYTES,normalizeState,parse,serialize};
})();
if (typeof module !== 'undefined') module.exports = NocturneBackup;
