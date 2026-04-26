package translator

import "testing"

func TestToUniLanBasic(t *testing.T) {
	cases := map[string]string{
		"A":     "/-",
		"AB":    "/-|:",
		"hi":    "˦!",
		"HELLO": "˦|~\\_\\_[]",
	}
	for in, want := range cases {
		if got := ToUniLan(in); got != want {
			t.Errorf("ToUniLan(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestToUniLanPreservesSpaces(t *testing.T) {
	got := ToUniLan("hi there")
	want := "˦! ‾‾˦|~マ|~"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestRoundTrip(t *testing.T) {
	in := "HELLO WORLD"
	enc := ToUniLan(in)
	dec := FromUniLan(enc)
	if dec != in {
		t.Errorf("round trip: got %q, want %q", dec, in)
	}
}

func TestIsLatin(t *testing.T) {
	if !IsLatin("hello world") {
		t.Error("hello world should be Latin")
	}
	if IsLatin("привет мир") {
		t.Error("Russian should not be Latin")
	}
	if !IsLatin("") {
		t.Error("empty should be Latin")
	}
}
