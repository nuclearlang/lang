import 'package:flutter_bloc/flutter_bloc.dart';

/// Base of the classes of the `statemanager` kind: a Cubit whose state is a state model.
abstract class StateManager<S> extends Cubit<S> {
  StateManager(super.initialState);

  /// Emits only while the manager is open (a screen that was closed does not receive late results).
  @override
  void emit(S state) {
    if (!isClosed) super.emit(state);
  }

  int _turns = 0;

  /// A new call of an asynchronous state method (`@state`): its turn. Only the latest call's answer is emitted.
  int stateTurn() => ++_turns;

  /// Whether no asynchronous state method was called after the one of [stateTurn]: an older answer that comes late is
  /// dropped instead of replacing the newer state.
  bool isLatestTurn(int turn) => turn == _turns;
}
