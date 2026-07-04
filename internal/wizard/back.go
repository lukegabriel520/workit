package wizard

const Back = "__workit_back__"

func IsBack[T any](value any) bool {
	s, ok := value.(string)
	return ok && s == Back
}
