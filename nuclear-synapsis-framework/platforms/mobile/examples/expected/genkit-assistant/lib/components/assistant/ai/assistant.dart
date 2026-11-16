import 'package:genkit_assistant/components/assistant/ai/note_tools.dart';
import 'package:synapsis_genkit/synapsis_genkit.dart';

/// The assistant of the chat screen: it keeps notes with its tools.
class Assistant extends Chat {
  Assistant(this.notes);

  final NoteTools notes;

  @override
  List<Object?> get dependencies => [notes];

  @override
  final String prompt = 'You are a helpful assistant. Use the tools to save and list notes. Answer briefly.';
}
