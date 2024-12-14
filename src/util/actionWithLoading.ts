import yoctoSpinner from "yocto-spinner";

export default async function actionWithLoading<T>(
  loadingText: string,
  action: () => Promise<T>,
) {
  const spinner = yoctoSpinner({ text: loadingText }).start();

  const result = await action();

  spinner.stop();

  return result;
}
