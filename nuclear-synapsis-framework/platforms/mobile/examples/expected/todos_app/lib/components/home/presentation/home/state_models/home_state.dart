import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// Each field is a state of the screen; a boolean state carries no data.
enum HomeStateStatus { initial, items, error, loading }

class HomeState {
  const HomeState._({required this.status, this.items, this.error});

  const HomeState.initial() : this._(status: HomeStateStatus.initial);
  const HomeState.items(List<String> items) : this._(status: HomeStateStatus.items, items: items);
  const HomeState.error(String error) : this._(status: HomeStateStatus.error, error: error);
  const HomeState.loading() : this._(status: HomeStateStatus.loading);

  final HomeStateStatus status;
  final List<String>? items;
  final String? error;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is HomeState &&
          status == other.status &&
          listEquals(items, other.items) &&
          error == other.error;

  @override
  int get hashCode => Object.hash(status, Object.hashAll([Object.hashAll(items ?? const []), error, ]));

  @override
  String toString() => 'HomeState.${status.name}';
}

/// One widget for each state of [HomeState]; a state without a builder shows [orElse].
class HomeStateBuilder<M extends StateStreamable<HomeState>> extends StatelessWidget {
  const HomeStateBuilder({super.key, this.initial, this.items, this.error, this.loading, this.orElse});

  final Widget Function()? initial;
  final Widget Function(List<String> items)? items;
  final Widget Function(String error)? error;
  final Widget Function()? loading;
  final Widget Function()? orElse;

  @override
  Widget build(BuildContext context) => BlocBuilder<M, HomeState>(
        builder: (context, state) =>
            switch (state.status) {
              HomeStateStatus.initial => initial?.call(),
              HomeStateStatus.items => items?.call(state.items!),
              HomeStateStatus.error => error?.call(state.error!),
              HomeStateStatus.loading => loading?.call(),
            } ??
            orElse?.call() ??
            const SizedBox.shrink(),
      );
}
