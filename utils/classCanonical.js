/**
 * Class name canonicalization and educational section helpers
 */

export function canonicalizeClassLevel(input = '') {
  if (!input) return '';
  const str = String(input).trim().replace(/\s+/g, ' ');

  // 1. JSS / Junior Secondary: (jss|js|junior)\s*([1-9])
  const jssMatch = str.match(/^(?:jss|js|junior\s*sec(?:ondary)?)\s*([1-9])$/i);
  if (jssMatch) {
    return `JSS ${jssMatch[1]}`;
  }

  // 2. SS / SSS / Senior Secondary: (sss|ss|senior)\s*([1-9])
  const ssMatch = str.match(/^(?:sss|ss|senior\s*sec(?:ondary)?)\s*([1-9])$/i);
  if (ssMatch) {
    return `SS ${ssMatch[1]}`;
  }

  // 3. Primary: (primary|pri)\s*([1-9])
  const primaryMatch = str.match(/^(?:primary|pri)\s*([1-9])$/i);
  if (primaryMatch) {
    return `Primary ${primaryMatch[1]}`;
  }

  // 4. Basic: basic\s*([1-9])$
  const basicMatch = str.match(/^basic\s*([1-9])$/i);
  if (basicMatch) {
    return `Basic ${basicMatch[1]}`;
  }

  // 5. Nursery: (nursery|nur)\s*([1-9])
  const nurseryMatch = str.match(/^(?:nursery|nur)\s*([1-9])$/i);
  if (nurseryMatch) {
    return `Nursery ${nurseryMatch[1]}`;
  }

  // 6. KG / Kindergarten: (kg|kindergarten)\s*([1-9])
  const kgMatch = str.match(/^(?:kg|kindergarten)\s*([1-9])$/i);
  if (kgMatch) {
    return `KG ${kgMatch[1]}`;
  }

  // 7. Grade: grade\s*([1-9])$
  const gradeMatch = str.match(/^grade\s*([1-9])$/i);
  if (gradeMatch) {
    return `Grade ${gradeMatch[1]}`;
  }

  // 8. General: if letters immediately followed by digits e.g. "Year1" -> "Year 1"
  const generalAlphaNum = str.match(/^([a-zA-Z]+)\s*(\d+)$/);
  if (generalAlphaNum) {
    const word = generalAlphaNum[1];
    const num = generalAlphaNum[2];
    const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    return `${capitalizedWord} ${num}`;
  }

  // 9. Otherwise, capitalize first letter of each word
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function canonicalizeArm(arm) {
  if (arm === undefined || arm === null) return null;
  const str = String(arm).trim().replace(/\s+/g, ' ');
  if (!str) return null;

  // Single letter e.g. "a" -> "A"
  if (/^[a-zA-Z]$/.test(str)) {
    return str.toUpperCase();
  }

  // Word e.g. "science" -> "Science", "arts" -> "Arts"
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function inferEducationSection(classLevel = '') {
  const normalized = String(classLevel || '').trim().toUpperCase();

  if (
    /^(NURSERY|NUR|KG|KINDERGARTEN|CRECHE|RECEPTION|PRE-PRIMARY|PLAYGROUP)/i.test(
      normalized
    )
  ) {
    return 'EARLY_YEARS';
  }

  if (
    /^(JSS|JS|JUNIOR)/i.test(normalized) ||
    /^BASIC\s*(7|8|9)\b/i.test(normalized)
  ) {
    return 'JUNIOR_SECONDARY';
  }

  if (/^(SSS|SS|SENIOR)/i.test(normalized)) {
    return 'SENIOR_SECONDARY';
  }

  return 'PRIMARY';
}

export function normalizeOrInferEducationSection(educationSection, classLevel) {
  const allowed = ['EARLY_YEARS', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'];
  if (educationSection && allowed.includes(String(educationSection).trim().toUpperCase())) {
    return String(educationSection).trim().toUpperCase();
  }
  return inferEducationSection(classLevel);
}
