/// The texts of Synapsis's own widgets (dialog buttons, form messages). An app dictionary with the same
/// key wins (`assets/i18n/<locale>/synapsis.json`: `{"dialog": {"accept": "OK"}}`); a locale that is not
/// here uses English.
const Map<String, Map<String, String>> builtinWords = {
  'en': {
    'synapsis.dialog.accept': 'Accept',
    'synapsis.dialog.close': 'Close',
    'synapsis.form.required': 'Required',
    'synapsis.form.email': 'Invalid email',
    'synapsis.form.url': 'Invalid URL',
    'synapsis.form.number': 'Must be a number',
    'synapsis.form.wholeNumber': 'Must be a whole number',
    'synapsis.form.minLength': 'At least {n} characters',
    'synapsis.form.maxLength': 'At most {n} characters',
    'synapsis.form.min': 'Must be at least {n}',
    'synapsis.form.max': 'Must be at most {n}',
    'synapsis.form.pattern': 'Invalid format',
    'synapsis.form.matches': 'Does not match',
  },
  'es': {
    'synapsis.dialog.accept': 'Aceptar',
    'synapsis.dialog.close': 'Cerrar',
    'synapsis.form.required': 'Obligatorio',
    'synapsis.form.email': 'Email no válido',
    'synapsis.form.url': 'URL no válida',
    'synapsis.form.number': 'Debe ser un número',
    'synapsis.form.wholeNumber': 'Debe ser un número entero',
    'synapsis.form.minLength': 'Al menos {n} caracteres',
    'synapsis.form.maxLength': 'Como máximo {n} caracteres',
    'synapsis.form.min': 'Debe ser al menos {n}',
    'synapsis.form.max': 'Debe ser como máximo {n}',
    'synapsis.form.pattern': 'Formato no válido',
    'synapsis.form.matches': 'No coincide',
  },
};
