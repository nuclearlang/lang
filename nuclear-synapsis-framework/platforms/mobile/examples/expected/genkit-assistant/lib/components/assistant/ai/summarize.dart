import 'package:genkit_assistant/components/assistant/domain/models/summary.dart';
import 'package:synapsis_genkit/synapsis_genkit.dart';

/// Summarizes a text into a title and its main points.
class Summarize extends GenkitFlow<String, Summary> {
  @override
  String get flowName => 'summarize';

  @override
  Future<Summary> run(String text) async {
    return await generateObject<Summary>('Summarize this text as a title and at most 3 short points: $text');
  }
}
