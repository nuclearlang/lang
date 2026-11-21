import 'package:clean_flutter_project/components/session/domain/models/auth.dart';
import 'package:clean_flutter_project/components/session/presentation/login/forms/login_form.dart';
import 'package:clean_flutter_project/components/session/presentation/login/state_models/login_state.dart';
import 'package:clean_flutter_project/components/session/session_component.dart';
import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';

class LoginManager extends StateManager<LoginState> {
  LoginManager(this.session) : super(const LoginState.initial());

  final SessionComponent session;

  void loading() => emit(LoginState.loading());

  Future<void> login(LoginForm form) async {
    loading();
    final turn$ = stateTurn();
    final result = await _login(form);
    if (!isLatestTurn(turn$)) return;
    emit(result.match(LoginState.error, LoginState.done));
  }

  Future<Either<AuthError, Auth>> _login(LoginForm form) async {
    return await session.login(form.user, form.pass);
  }
}
