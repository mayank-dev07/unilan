package translator

import (
	"strings"
	"unicode"
)

// UNI LAN alphabet mapping. Keys are uppercase English letters and digit 0.
var enToUniLan = map[rune]string{
	'A': "/-",
	'B': "|:",
	'C': "(",
	'D': "|]",
	'E': "|~",
	'F': "Г",
	'G': "ᮌ",
	'H': "˦",
	'I': "!",
	'J': "_/",
	'K': "|<",
	'L': "\\_",
	'M': "𐍜",
	'N': "ה",
	'O': "[]",
	'P': "|⸣",
	'Q': "Ω",
	'R': "マ",
	'S': "_|‾‾",
	'T': "‾‾",
	'U': "|_",
	'V': "v",
	'W': "\\\\\\",
	'X': "⅄",
	'Y': ">",
	'Z': "‾‾|_",
	'0': "[]",
}

// Reverse map built once at init. Note: '0' and 'O' both map to "[]" — reverse
// resolves to 'O' (more common in text). Numeric 0 in input is preserved as-is
// during reverse since the source rarely round-trips through it.
var uniLanToEn map[string]rune

// Sorted list of UNI LAN symbols (longest first) for greedy decode.
var uniLanSymbols []string

func init() {
	uniLanToEn = make(map[string]rune, len(enToUniLan))
	for r, sym := range enToUniLan {
		if r == '0' {
			continue
		}
		uniLanToEn[sym] = r
	}
	for sym := range uniLanToEn {
		uniLanSymbols = append(uniLanSymbols, sym)
	}
	// sort by length desc so greedy decode prefers longer matches first
	for i := 1; i < len(uniLanSymbols); i++ {
		for j := i; j > 0 && len(uniLanSymbols[j]) > len(uniLanSymbols[j-1]); j-- {
			uniLanSymbols[j], uniLanSymbols[j-1] = uniLanSymbols[j-1], uniLanSymbols[j]
		}
	}
}

// ToUniLan converts an English string to its UNI LAN representation.
// Letters are uppercased before mapping. Spaces, digits, and punctuation
// pass through unchanged (except '0' which has its own glyph).
func ToUniLan(s string) string {
	var b strings.Builder
	b.Grow(len(s) * 2)
	for _, r := range s {
		ru := unicode.ToUpper(r)
		if sym, ok := enToUniLan[ru]; ok {
			b.WriteString(sym)
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// FromUniLan attempts a best-effort decode of UNI LAN back to English.
// Greedy longest-match. Unrecognized runes pass through.
func FromUniLan(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	i := 0
	for i < len(s) {
		matched := false
		for _, sym := range uniLanSymbols {
			if strings.HasPrefix(s[i:], sym) {
				b.WriteRune(uniLanToEn[sym])
				i += len(sym)
				matched = true
				break
			}
		}
		if !matched {
			r, size := decodeRune(s[i:])
			b.WriteRune(r)
			i += size
		}
	}
	return b.String()
}

func decodeRune(s string) (rune, int) {
	for _, r := range s {
		// return first rune and its byte length
		return r, len(string(r))
	}
	return 0, 0
}

// IsLatin reports whether the string consists primarily (>=80%) of Latin /
// ASCII letters and common punctuation. Used to decide whether LLM
// pre-translation is needed.
func IsLatin(s string) bool {
	letters, latin := 0, 0
	for _, r := range s {
		if unicode.IsLetter(r) {
			letters++
			if r < 0x0250 { // Latin + Latin-1 + Latin Extended-A/B
				latin++
			}
		}
	}
	if letters == 0 {
		return true
	}
	return float64(latin)/float64(letters) >= 0.8
}
