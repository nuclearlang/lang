import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/components/home/domain/usecases/hello_home_usecase.dart';

/// Facade of the home component: the only part other components can use.
class HomeComponent {
  Either<String, List<String>> hello() {
    return inject<HelloHomeUseCase>().exec();
  }
}
