import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/components/home/home_component.dart';
import 'package:todos_app/components/home/presentation/home/state_models/home_state.dart';

class HomeManager extends StateManager<HomeState> {
  HomeManager(this.component) : super(const HomeState.initial()) {
    load();
  }

  final HomeComponent component;

  void loading() => emit(HomeState.loading());

  /// the screen's data: call a use case of the component here (`component.<alias>()`); a component made by
  /// `gen resource` has no `hello`, so the skeleton assumes none
  void load() {
    loading();
    final result = _load();
    emit(result.match(HomeState.error, HomeState.items));
  }

  Either<String, List<String>> _load() {
    return Right([]);
  }
}
