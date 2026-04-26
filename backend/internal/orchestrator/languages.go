package orchestrator

// SupportedLanguages is the list of regional languages a user can pick at
// signup. Codes are ISO 639-1; names are English display names. Order is the
// order shown in the UI dropdown.
//
// `latin` indicates whether the language uses Latin script natively. Latin
// targets skip the romanize step in the orchestrator.
type LanguageInfo struct {
	Code  string `json:"code"`
	Name  string `json:"name"`
	Latin bool   `json:"latin"`
}

var SupportedLanguages = []LanguageInfo{
	{"en", "English", true},
	{"es", "Spanish", true},
	{"fr", "French", true},
	{"de", "German", true},
	{"it", "Italian", true},
	{"pt", "Portuguese", true},
	{"nl", "Dutch", true},
	{"pl", "Polish", true},
	{"tr", "Turkish", true},
	{"id", "Indonesian", true},
	{"vi", "Vietnamese", true},
	{"sv", "Swedish", true},

	{"ru", "Russian", false},
	{"uk", "Ukrainian", false},
	{"bg", "Bulgarian", false},

	{"zh", "Chinese", false},
	{"ja", "Japanese", false},
	{"ko", "Korean", false},
	{"th", "Thai", false},

	{"ar", "Arabic", false},
	{"he", "Hebrew", false},
	{"fa", "Persian", false},
	{"ur", "Urdu", false},

	{"hi", "Hindi", false},
	{"bn", "Bengali", false},
	{"mr", "Marathi", false},
	{"pa", "Punjabi", false},
	{"gu", "Gujarati", false},
	{"ta", "Tamil", false},
	{"te", "Telugu", false},
	{"kn", "Kannada", false},
	{"ml", "Malayalam", false},

	{"el", "Greek", false},
}

var langByCode = func() map[string]LanguageInfo {
	m := make(map[string]LanguageInfo, len(SupportedLanguages))
	for _, l := range SupportedLanguages {
		m[l.Code] = l
	}
	return m
}()

// LanguageName returns the English display name for an ISO code, or the code
// itself for unknown languages (so prompts like "Translate from xx to yy"
// degrade gracefully).
func LanguageName(code string) string {
	if l, ok := langByCode[code]; ok {
		return l.Name
	}
	return code
}

// IsLatinLang reports whether the language uses Latin script natively. Used
// to skip the romanization step when rendering for Latin-language viewers.
func IsLatinLang(code string) bool {
	if l, ok := langByCode[code]; ok {
		return l.Latin
	}
	// Default safe assumption for unknown codes: assume non-Latin so we
	// attempt romanization (which is a no-op if the text is already Latin).
	return false
}

// IsSupported reports whether a language code is one we know about.
func IsSupported(code string) bool {
	_, ok := langByCode[code]
	return ok
}
