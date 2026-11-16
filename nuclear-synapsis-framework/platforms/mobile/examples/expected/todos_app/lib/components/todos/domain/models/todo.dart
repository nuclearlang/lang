import 'package:json_annotation/json_annotation.dart';

part 'todo.g.dart';

/// Todo, as the API answers it.
@JsonSerializable(explicitToJson: true)
class Todo {
  const Todo({required this.id, required this.title, required this.completed});

  factory Todo.fromJson(Map<String, dynamic> json) => _$TodoFromJson(json);

  final int id;
  final String title;
  final bool completed;

  Map<String, dynamic> toJson() => _$TodoToJson(this);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Todo &&
          id == other.id &&
          title == other.title &&
          completed == other.completed;

  @override
  int get hashCode => Object.hashAll([id, title, completed]);
}
