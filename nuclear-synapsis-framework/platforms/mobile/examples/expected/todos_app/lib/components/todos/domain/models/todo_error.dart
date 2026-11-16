import 'package:json_annotation/json_annotation.dart';

part 'todo_error.g.dart';

/// What failed with todos: Synapsis builds it with the failure's message.
@JsonSerializable(explicitToJson: true)
class TodoError {
  const TodoError({required this.message});

  factory TodoError.fromJson(Map<String, dynamic> json) => _$TodoErrorFromJson(json);

  final String message;

  Map<String, dynamic> toJson() => _$TodoErrorToJson(this);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TodoError &&
          message == other.message;

  @override
  int get hashCode => Object.hashAll([message]);
}
