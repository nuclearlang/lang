import 'package:fpdart/fpdart.dart';

class HelloHomeUseCase {
  Either<String, List<String>> exec() {
    return Right(['Hello from home']);
  }
}
